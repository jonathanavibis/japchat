import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStory extends Document {
  userId: string;
  userName: string;
  userImage?: string;
  type: "image" | "text";
  mediaUrl?: string;
  caption?: string;
  bgColor?: string;
  viewedBy: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userImage: { type: String },
    type: { type: String, enum: ["image", "text"], default: "text" },
    mediaUrl: { type: String },
    caption: { type: String, trim: true, maxlength: 300 },
    bgColor: {
      type: String,
      default: "from-[#0084FF] via-[#6B4DFF] to-[#A033FF]",
    },
    viewedBy: { type: [String], default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

export const Story: Model<IStory> =
  mongoose.models.Story || mongoose.model<IStory>("Story", StorySchema);
