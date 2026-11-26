import { Router, Response } from "express";
import { connectMongoose } from "../../lib/db";
import { Story } from "../../models/Story";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/stories — all active (unexpired) stories
router.get("/", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await connectMongoose();
    const now = new Date();
    const stories = await Story.find({ expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      stories: stories.map((s) => ({
        ...s,
        _id: String(s._id),
      })),
    });
  } catch (err) {
    console.error("GET /api/stories error:", err);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// POST /api/stories — create a new 24h story
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectMongoose();
    const user = req.authSession!.user;
    const { type, mediaUrl, caption, bgColor } = req.body as {
      type?: "image" | "text";
      mediaUrl?: string;
      caption?: string;
      bgColor?: string;
    };

    if (type === "image" && !mediaUrl) {
      res.status(400).json({ error: "Image URL is required for image stories" });
      return;
    }
    if ((!type || type === "text") && !caption?.trim()) {
      res.status(400).json({ error: "Text is required for text stories" });
      return;
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

    res.status(201).json({
      story: {
        ...story.toObject(),
        _id: String(story._id),
      },
    });
  } catch (err) {
    console.error("POST /api/stories error:", err);
    res.status(500).json({ error: "Failed to create story" });
  }
});

// POST /api/stories/:id/view — mark story as viewed
router.post(
  "/:id/view",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await connectMongoose();
      await Story.findByIdAndUpdate(req.params.id, {
        $addToSet: { viewedBy: req.userId! },
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/stories/:id/view error:", err);
      res.status(500).json({ error: "Failed to mark story viewed" });
    }
  }
);

// DELETE /api/stories/:id — delete own story
router.delete(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await connectMongoose();
      const story = await Story.findById(req.params.id);
      if (!story) {
        res.status(404).json({ error: "Story not found" });
        return;
      }
      if (story.userId !== req.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await story.deleteOne();
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /api/stories/:id error:", err);
      res.status(500).json({ error: "Failed to delete story" });
    }
  }
);

export default router;
