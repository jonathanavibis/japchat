import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMedia extends Document {
  data: Buffer;
  contentType: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);
