import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

export async function GET(
  req: NextRequest,
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

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Number(limitParam) || 50, 100);
    const before = req.nextUrl.searchParams.get("before");

    const query: Record<string, unknown> = { conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    messages.reverse();

    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        _id: String(m._id),
        conversationId: String(m.conversationId),
      })),
    });
  } catch (err) {
    console.error("GET /api/conversations/:id/messages error:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
