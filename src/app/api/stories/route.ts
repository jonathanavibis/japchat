import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Story } from "@/models/Story";

export async function GET() {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();
    const now = new Date();
    const stories = await Story.find({ expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      stories: stories.map((s) => ({
        ...s,
        _id: String(s._id),
      })),
    });
  } catch (err) {
    console.error("GET /api/stories error:", err);
    return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectMongoose();
    const user = session.user;
    const { type, mediaUrl, caption, bgColor } = (await req.json()) as {
      type?: "image" | "text";
      mediaUrl?: string;
      caption?: string;
      bgColor?: string;
    };

    if (type === "image" && !mediaUrl) {
      return NextResponse.json(
        { error: "Image URL is required for image stories" },
        { status: 400 }
      );
    }
    if ((!type || type === "text") && !caption?.trim()) {
      return NextResponse.json(
        { error: "Text is required for text stories" },
        { status: 400 }
      );
    }

    const story = await Story.create({
      userId: user.id,
      userName: user.name,
      userImage: user.image || undefined,
      type: type || "text",
      mediaUrl,
      caption: caption?.trim(),
      bgColor: bgColor || "from-[#0084FF] via-[#6B4DFF] to-[#A033FF]",
      viewedBy: [user.id],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return NextResponse.json(
      {
        story: {
          ...story.toObject(),
          _id: String(story._id),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/stories error:", err);
    return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
  }
}
