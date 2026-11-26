import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getApiSession } from "@/lib/api-auth";
import { getMongoClient, getMongoDb } from "@/lib/db";
import { normalizeUser } from "@/server/routes/users";

export async function GET() {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getMongoClient();
    const db = getMongoDb();
    const userId = session.user.id;
    const query = ObjectId.isValid(userId)
      ? { $or: [{ id: userId }, { _id: new ObjectId(userId) }] }
      : { id: userId };

    const doc = await db.collection("user").findOne(query);
    return NextResponse.json({
      user: doc ? normalizeUser(doc as Record<string, unknown>) : null,
      settings: (doc?.settings as Record<string, unknown>) ?? null,
    });
  } catch (err) {
    console.error("GET /api/users/me error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getMongoClient();
    const db = getMongoDb();
    const { name, bio, image, settings } = (await req.json()) as {
      name?: string;
      bio?: string;
      image?: string;
      settings?: Record<string, unknown>;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof bio === "string") updates.bio = bio.trim();
    if (typeof image === "string") updates.image = image.trim();
    if (settings && typeof settings === "object") updates.settings = settings;

    const userId = session.user.id;
    const query = ObjectId.isValid(userId)
      ? { $or: [{ id: userId }, { _id: new ObjectId(userId) }] }
      : { id: userId };

    await db.collection("user").updateOne(query, { $set: updates });
    const updated = await db.collection("user").findOne(query);

    return NextResponse.json({
      user: updated ? normalizeUser(updated as Record<string, unknown>) : null,
      settings: (updated?.settings as Record<string, unknown>) ?? null,
    });
  } catch (err) {
    console.error("PATCH /api/users/me error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
