import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import { connectMongoose, getMongoClient, getMongoDb } from "../../lib/db";
import { Conversation } from "../../models/Conversation";
import { Message } from "../../models/Message";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { normalizeUser, PublicUser } from "./users";

const router = Router();

async function fetchUsersMap(userIds: string[]): Promise<Map<string, PublicUser>> {
  await getMongoClient();
  const db = getMongoDb();
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return new Map();

  const objectIds = uniqueIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const docs = await db
    .collection("user")
    .find({
      $or: [
        { id: { $in: uniqueIds } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    })
    .toArray();

  const map = new Map<string, PublicUser>();
  for (const d of docs) {
    const u = normalizeUser(d as Record<string, unknown>);
    map.set(u.id, u);
  }
  return map;
}

// GET /api/conversations
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectMongoose();
    const userId = req.userId!;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .lean();

    const allParticipantIds = conversations.flatMap((c) => c.participants);
    const usersMap = await fetchUsersMap(allParticipantIds);

    // Compute unread counts per conversation
    const unreadAgg = await Message.aggregate<{ _id: ObjectId; count: number }>([
      {
        $match: {
          conversationId: { $in: conversations.map((c) => c._id) },
          senderId: { $ne: userId },
          "seenBy.userId": { $ne: userId },
          deleted: { $ne: true },
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);

    const unreadMap = new Map<string, number>();
    for (const row of unreadAgg) {
      unreadMap.set(String(row._id), row.count);
    }

    const enriched = conversations.map((c) => ({
      ...c,
      _id: String(c._id),
      participantDetails: c.participants
        .map((pid) => usersMap.get(pid))
        .filter(Boolean),
      unreadCount: unreadMap.get(String(c._id)) || 0,
    }));

    res.json({ conversations: enriched });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// POST /api/conversations
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectMongoose();
    const userId = req.userId!;
    const { isGroup, name, participantId, participantIds } = req.body as {
      isGroup?: boolean;
      name?: string;
      participantId?: string;
      participantIds?: string[];
    };

    if (isGroup) {
      const members = Array.from(
        new Set([userId, ...(Array.isArray(participantIds) ? participantIds : [])])
      );
      if (!name?.trim() || members.length < 2) {
        res.status(400).json({ error: "Group name and at least 2 members required" });
        return;
      }

      const created = await Conversation.create({
        isGroup: true,
        name: name.trim(),
        participants: members,
        admins: [userId],
      });

      const usersMap = await fetchUsersMap(created.participants);
      res.status(201).json({
        conversation: {
          ...created.toObject(),
          _id: String(created._id),
          participantDetails: created.participants
            .map((pid) => usersMap.get(pid))
            .filter(Boolean),
          unreadCount: 0,
        },
      });
      return;
    }

    if (!participantId || participantId === userId) {
      res.status(400).json({ error: "Valid participantId is required" });
      return;
    }

    // Find existing 1-on-1 conversation
    const existing = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [userId, participantId], $size: 2 },
    }).lean();

    const convObj =
      existing ??
      (
        await Conversation.create({
          isGroup: false,
          participants: [userId, participantId],
          admins: [],
        })
      ).toObject();

    const usersMap = await fetchUsersMap(convObj.participants);
    res.json({
      conversation: {
        ...convObj,
        _id: String(convObj._id),
        participantDetails: convObj.participants
          .map((pid) => usersMap.get(pid))
          .filter(Boolean),
        unreadCount: 0,
      },
    });
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/conversations/:id/messages
router.get(
  "/:id/messages",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await connectMongoose();
      const userId = req.userId!;
      const conversationId = String(req.params.id);

      const conv = await Conversation.findById(conversationId).lean();
      if (!conv || !conv.participants.includes(userId)) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const before = typeof req.query.before === "string" ? req.query.before : null;

      const query: Record<string, unknown> = { conversationId };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      messages.reverse();

      res.json({
        messages: messages.map((m) => ({
          ...m,
          _id: String(m._id),
          conversationId: String(m.conversationId),
        })),
      });
    } catch (err) {
      console.error("GET /api/conversations/:id/messages error:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  }
);

export default router;
