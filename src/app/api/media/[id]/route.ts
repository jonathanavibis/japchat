import { NextRequest, NextResponse } from "next/server";
import { connectMongoose } from "@/lib/db";
import { Media } from "@/models/Media";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await connectMongoose();
    const doc = await Media.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = new Uint8Array(doc.data as unknown as ArrayBuffer);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": doc.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("GET /api/media/:id error:", err);
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}
