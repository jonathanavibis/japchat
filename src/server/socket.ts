import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { ObjectId } from "mongodb";
import { auth } from "../lib/auth";
import { connectMongoose, getMongoClient, getMongoDb } from "../lib/db";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";

interface AuthedSocket extends Socket {
  userId?: string;
  userName?: string;
  userImage?: string | null;
}

// userId -> Set of active socket IDs
const onlineUsers = new Map<string, Set<string>>();

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  // Authenticate socket connection via Better Auth session cookie
  io.use(async (socket: AuthedSocket, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.handshake.headers),
      });
      if (!session || !session.user) {
        return next(new Error("Unauthorized"));
      }
      socket.userId = session.user.id;
      socket.userName = session.user.name;
      socket.userImage = session.user.image ?? null;
      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    const userName = socket.userName || "User";

    // Track online status
    let userSockets = onlineUsers.get(userId);
    const wasOffline = !userSockets || userSockets.size === 0;
    if (!userSockets) {
      userSockets = new Set();
      onlineUsers.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // Join personal room
    socket.join(`user:${userId}`);

    try {
      await connectMongoose();
      const convs = await Conversation.find({ participants: userId })
        .select("_id")
        .lean();

      for (const c of convs) {
        socket.join(`conv:${String(c._id)}`);
      }

      // Mark undelivered messages in user's conversations as delivered
      const convIds = convs.map((c) => c._id);
      if (convIds.length > 0) {
        await Message.updateMany(
          {
            conversationId: { $in: convIds },
            senderId: { $ne: userId },
            deliveredTo: { $ne: userId },
          },
          { $addToSet: { deliveredTo: userId } }
        );
        for (const cid of convIds) {
          socket.to(`conv:${String(cid)}`).emit("message:delivered", {
            conversationId: String(cid),
            userId,
          });
        }
      }
    } catch (err) {
      console.error("Socket room join error:", err);
    }

    // Send current online users to this socket
    socket.emit("presence:list", { onlineUserIds: getOnlineUserIds() });

    if (wasOffline) {
      io.emit("presence:update", { userId, online: true });
    }

    // Join a specific conversation room (e.g. newly created)
    socket.on("conversation:join", async ({ conversationId }: { conversationId: string }) => {
      try {
        await connectMongoose();
        const conv = await Conversation.findById(conversationId).lean();
        if (conv && conv.participants.includes(userId)) {
          socket.join(`conv:${conversationId}`);
        }
      } catch (err) {
        console.error("conversation:join error:", err);
      }
    });

    // Send a message
    socket.on(
      "message:send",
      async (
        payload: {
          conversationId: string;
          type?: "text" | "image" | "file" | "audio";
          text?: string;
          mediaUrl?: string;
          fileName?: string;
          fileSize?: number;
          audioDuration?: number;
          replyTo?: {
            messageId: string;
            text: string;
            senderName: string;
            type: "text" | "image" | "file" | "audio";
          };
          tempId?: string;
        },
        callback?: (res: { ok: boolean; message?: unknown; error?: string }) => void
      ) => {
        try {
          await connectMongoose();
          const {
            conversationId,
            type = "text",
            text = "",
            mediaUrl,
            fileName,
            fileSize,
            audioDuration,
            replyTo,
            tempId,
          } = payload;

          const conv = await Conversation.findById(conversationId);
          if (!conv || !conv.participants.includes(userId)) {
            callback?.({ ok: false, error: "Conversation not found" });
            return;
          }

          // Determine which other participants are currently online -> deliveredTo
          const deliveredTo = conv.participants.filter(
            (pid) => pid !== userId && onlineUsers.has(pid)
          );

          const msgDoc = await Message.create({
            conversationId: conv._id,
            senderId: userId,
            senderName: userName,
            senderImage: socket.userImage || undefined,
            type,
            text,
            mediaUrl,
            fileName,
            fileSize,
            audioDuration,
            deliveredTo,
            seenBy: [{ userId, seenAt: new Date() }],
            reactions: [],
            replyTo,
          });

          const previewText =
            type === "text"
              ? text
              : type === "image"
              ? "Sent a photo"
              : type === "audio"
              ? "Sent a voice message"
              : `Sent a file: ${fileName || "attachment"}`;

          conv.lastMessage = {
            text: previewText,
            type,
            senderId: userId,
            senderName: userName,
            createdAt: msgDoc.createdAt,
          };
          await conv.save();

          const serialized = {
            ...msgDoc.toObject(),
            _id: String(msgDoc._id),
            conversationId: String(msgDoc.conversationId),
            tempId,
          };

          // Broadcast to conversation room and each participant's personal room
          io.to(`conv:${conversationId}`).emit("message:new", serialized);
          for (const pid of conv.participants) {
            io.to(`user:${pid}`).emit("conversation:updated", {
              conversationId,
              lastMessage: conv.lastMessage,
              updatedAt: conv.updatedAt,
            });
          }

          callback?.({ ok: true, message: serialized });
        } catch (err) {
          console.error("message:send error:", err);
          callback?.({ ok: false, error: "Failed to send message" });
        }
      }
    );

    // Typing indicators
    socket.on("typing:start", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        userName,
        isTyping: true,
      });
    });

    socket.on("typing:stop", ({ conversationId }: { conversationId: string }) => {
      socket.to(`conv:${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        userName,
        isTyping: false,
      });
    });

    // Read receipts (Seen)
    socket.on("message:seen", async ({ conversationId }: { conversationId: string }) => {
      try {
        await connectMongoose();
        const conv = await Conversation.findById(conversationId).lean();
        if (!conv || !conv.participants.includes(userId)) return;

        const now = new Date();
        await Message.updateMany(
          {
            conversationId: conv._id,
            senderId: { $ne: userId },
            "seenBy.userId": { $ne: userId },
          },
          {
            $push: { seenBy: { userId, seenAt: now } },
            $addToSet: { deliveredTo: userId },
          }
        );

        io.to(`conv:${conversationId}`).emit("message:seen_update", {
          conversationId,
          userId,
          seenAt: now.toISOString(),
        });
      } catch (err) {
        console.error("message:seen error:", err);
      }
    });

    // Emoji reactions
    socket.on(
      "message:react",
      async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
        try {
          await connectMongoose();
          const msg = await Message.findById(messageId);
          if (!msg) return;

          const conv = await Conversation.findById(msg.conversationId).lean();
          if (!conv || !conv.participants.includes(userId)) return;

          const existingIdx = msg.reactions.findIndex((r) => r.userId === userId);
          if (existingIdx !== -1) {
            if (msg.reactions[existingIdx].emoji === emoji) {
              msg.reactions.splice(existingIdx, 1);
            } else {
              msg.reactions[existingIdx].emoji = emoji;
              msg.reactions[existingIdx].userName = userName;
            }
          } else {
            msg.reactions.push({ emoji, userId, userName });
          }

          await msg.save();

          io.to(`conv:${String(msg.conversationId)}`).emit("message:reaction_update", {
            messageId: String(msg._id),
            conversationId: String(msg.conversationId),
            reactions: msg.reactions,
          });
        } catch (err) {
          console.error("message:react error:", err);
        }
      }
    );

    // Disconnect
    socket.on("disconnect", async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();
          try {
            await getMongoClient();
            const db = getMongoDb();
            const query = ObjectId.isValid(userId)
              ? { $or: [{ id: userId }, { _id: new ObjectId(userId) }] }
              : { id: userId };
            await db.collection("user").updateOne(query, { $set: { lastSeen } });
          } catch (err) {
            console.error("Failed to update lastSeen:", err);
          }
          io.emit("presence:update", {
            userId,
            online: false,
            lastSeen: lastSeen.toISOString(),
          });
        }
      }
    });
  });

  return io;
}
