import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getMongoClient, getMongoDb } from "@/lib/db";
import { normalizeUser } from "@/server/routes/users";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getMongoClient();
    const db = getMongoDb();
    const q = req.nextUrl.searchParams.get("q")?.trim() || "";

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const docs = await db.collection("user").find(filter).limit(50).toArray();
    const users = docs
      .map((d) => normalizeUser(d as Record<string, unknown>))
      .filter((u) => u.id !== session.user.id);

    return NextResponse.json({ users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
