import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose, getMongoClient, getMongoDb } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { normalizeUser, PublicUser } from "@/server/routes/users";

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

export async function GET() {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();
    const userId = session.user.id;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .lean();

    const allParticipantIds = conversations.flatMap((c) => c.participants);
    const usersMap = await fetchUsersMap(allParticipantIds);

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

    return NextResponse.json({ conversations: enriched });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();
    const userId = session.user.id;
    const { isGroup, name, participantId, participantIds } = (await req.json()) as {
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
        return NextResponse.json(
          { error: "Group name and at least 2 members required" },
          { status: 400 }
        );
      }

      const created = await Conversation.create({
        isGroup: true,
        name: name.trim(),
        participants: members,
        admins: [userId],
      });

      const usersMap = await fetchUsersMap(created.participants);
      return NextResponse.json(
        {
          conversation: {
            ...created.toObject(),
            _id: String(created._id),
            participantDetails: created.participants
              .map((pid) => usersMap.get(pid))
              .filter(Boolean),
            unreadCount: 0,
          },
        },
        { status: 201 }
      );
    }

    if (!participantId || participantId === userId) {
      return NextResponse.json(
        { error: "Valid participantId is required" },
        { status: 400 }
      );
    }

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
    return NextResponse.json({
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
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
