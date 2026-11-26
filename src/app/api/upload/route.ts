import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { connectMongoose } from "@/lib/db";
import { Media } from "@/models/Media";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 4.5MB on serverless)" },
        { status: 413 }
      );
    }

    await connectMongoose();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = file.type || "application/octet-stream";

    const doc = await Media.create({
      data: buffer,
      contentType: mime,
      fileName: file.name || "attachment",
      fileSize: file.size,
      uploadedBy: session.user.id,
    });

    let kind: "image" | "audio" | "file" = "file";
    if (mime.startsWith("image/")) kind = "image";
    else if (mime.startsWith("audio/")) kind = "audio";

    return NextResponse.json({
      url: `/api/media/${String(doc._id)}`,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: mime,
      kind,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
