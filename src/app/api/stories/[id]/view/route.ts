import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Story } from "@/models/Story";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    await connectMongoose();
    await Story.findByIdAndUpdate(id, {
      $addToSet: { viewedBy: session.user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/stories/:id/view error:", err);
    return NextResponse.json({ error: "Failed to mark story viewed" }, { status: 500 });
  }
}
