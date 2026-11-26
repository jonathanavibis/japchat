import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: messageId } = await context.params;
    const { emoji } = (await req.json()) as { emoji: string };
    await connectMongoose();

    const msg = await Message.findById(messageId);
    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const conv = await Conversation.findById(msg.conversationId).lean();
    if (!conv || !conv.participants.includes(session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;
    const userName = session.user.name;
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
    return NextResponse.json({ reactions: msg.reactions });
  } catch (err) {
    console.error("POST /api/messages/:id/react error:", err);
    return NextResponse.json({ error: "Failed to react" }, { status: 500 });
  }
}
