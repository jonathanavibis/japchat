import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import { getMongoClient, getMongoDb } from "../../lib/db";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

const router = Router();

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  bio?: string;
  lastSeen?: Date | string | null;
}

export function normalizeUser(u: Record<string, unknown>): PublicUser {
  return {
    id: String(u.id || u._id),
    name: String(u.name || "User"),
    email: String(u.email || ""),
    image: (u.image as string | null) ?? null,
    bio: (u.bio as string) ?? "Hey there! I am using JapChat.",
    lastSeen: (u.lastSeen as Date | string | null) ?? null,
  };
}

// GET /api/users?q=...
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getMongoClient();
    const db = getMongoDb();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const docs = await db
      .collection("user")
      .find(filter)
      .limit(50)
      .toArray();

    const users = docs
      .map((d) => normalizeUser(d as Record<string, unknown>))
      .filter((u) => u.id !== req.userId);

    res.json({ users });
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/users/me
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getMongoClient();
    const db = getMongoDb();
    const userId = req.userId!;
    const query = ObjectId.isValid(userId)
      ? { $or: [{ id: userId }, { _id: new ObjectId(userId) }] }
      : { id: userId };

    const doc = await db.collection("user").findOne(query);
    res.json({
      user: doc ? normalizeUser(doc as Record<string, unknown>) : null,
      settings: (doc?.settings as Record<string, unknown>) ?? null,
    });
  } catch (err) {
    console.error("GET /api/users/me error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/users/me
router.patch("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getMongoClient();
    const db = getMongoDb();
    const { name, bio, image, settings } = req.body as {
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

    const userId = req.userId!;
    const query = ObjectId.isValid(userId)
      ? { $or: [{ id: userId }, { _id: new ObjectId(userId) }] }
      : { id: userId };

    await db.collection("user").updateOne(query, { $set: updates });
    const updated = await db.collection("user").findOne(query);

    res.json({
      user: updated ? normalizeUser(updated as Record<string, unknown>) : null,
      settings: (updated?.settings as Record<string, unknown>) ?? null,
    });
  } catch (err) {
    console.error("PATCH /api/users/me error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
