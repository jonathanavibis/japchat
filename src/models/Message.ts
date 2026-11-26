import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISeenEntry {
  userId: string;
  seenAt: Date;
}

export interface IReactionEntry {
  emoji: string;
  userId: string;
  userName: string;
}

export interface IReplyPreview {
  messageId: string;
  text: string;
  senderName: string;
  type: "text" | "image" | "file" | "audio";
}

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: string;
  senderName: string;
  senderImage?: string;
  type: "text" | "image" | "file" | "audio";
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  audioDuration?: number;
  deliveredTo: string[];
  seenBy: ISeenEntry[];
  reactions: IReactionEntry[];
  replyTo?: IReplyPreview;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReplyPreviewSchema = new Schema<IReplyPreview>(
  {
    messageId: { type: String },
    text: { type: String },
    senderName: { type: String },
    type: { type: String, enum: ["text", "image", "file", "audio"] },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    senderImage: { type: String },
    type: {
      type: String,
      enum: ["text", "image", "file", "audio"],
      default: "text",
    },
    text: { type: String, default: "" },
    mediaUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    audioDuration: { type: Number },
    deliveredTo: { type: [String], default: [] },
    seenBy: [
      {
        _id: false,
        userId: { type: String, required: true },
        seenAt: { type: Date, default: Date.now },
      },
    ],
    reactions: [
      {
        _id: false,
        emoji: { type: String, required: true },
        userId: { type: String, required: true },
        userName: { type: String, required: true },
      },
    ],
    replyTo: {
      type: ReplyPreviewSchema,
      default: undefined,
    },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
