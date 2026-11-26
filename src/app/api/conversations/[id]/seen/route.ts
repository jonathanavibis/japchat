import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: conversationId } = await context.params;
    await connectMongoose();
    const userId = session.user.id;

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv || !conv.participants.includes(userId)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/conversations/:id/seen error:", err);
    return NextResponse.json({ error: "Failed to mark seen" }, { status: 500 });
  }
}
