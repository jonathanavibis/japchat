import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();
    const user = session.user;
    const {
      conversationId,
      type = "text",
      text = "",
      mediaUrl,
      fileName,
      fileSize,
      audioDuration,
      replyTo,
    } = (await req.json()) as {
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
    };

    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.participants.includes(user.id)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const msgDoc = await Message.create({
      conversationId: conv._id,
      senderId: user.id,
      senderName: user.name,
      senderImage: user.image || undefined,
      type,
      text,
      mediaUrl,
      fileName,
      fileSize,
      audioDuration,
      deliveredTo: [],
      seenBy: [{ userId: user.id, seenAt: new Date() }],
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
      senderId: user.id,
      senderName: user.name,
      createdAt: msgDoc.createdAt,
    };
    await conv.save();

    return NextResponse.json({
      message: {
        ...msgDoc.toObject(),
        _id: String(msgDoc._id),
        conversationId: String(msgDoc.conversationId),
      },
    });
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
