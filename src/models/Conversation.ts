import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILastMessage {
  text: string;
  type: "text" | "image" | "file" | "audio";
  senderId: string;
  senderName: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  isGroup: boolean;
  name?: string;
  avatar?: string;
  participants: string[];
  admins: string[];
  lastMessage?: ILastMessage;
  createdAt: Date;
  updatedAt: Date;
}

const LastMessageSchema = new Schema<ILastMessage>(
  {
    text: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "image", "file", "audio"],
      default: "text",
    },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true },
    avatar: { type: String },
    participants: { type: [String], required: true, index: true },
    admins: { type: [String], default: [] },
    lastMessage: { type: LastMessageSchema },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1, updatedAt: -1 });

export const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);
