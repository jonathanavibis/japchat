export interface ChatUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  bio?: string;
  lastSeen?: string | null;
}

export interface ReactionItem {
  emoji: string;
  userId: string;
  userName: string;
}

export interface SeenItem {
  userId: string;
  seenAt: string;
}

export interface ReplyPreview {
  messageId: string;
  text: string;
  senderName: string;
  type: "text" | "image" | "file" | "audio";
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
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
  seenBy: SeenItem[];
  reactions: ReactionItem[];
  replyTo?: ReplyPreview;
  deleted?: boolean;
  createdAt: string;
  tempId?: string;
}

export interface LastMessage {
  text: string;
  type: "text" | "image" | "file" | "audio";
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface ChatConversation {
  _id: string;
  isGroup: boolean;
  name?: string;
  avatar?: string;
  participants: string[];
  admins: string[];
  participantDetails: ChatUser[];
  lastMessage?: LastMessage;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ChatStory {
  _id: string;
  userId: string;
  userName: string;
  userImage?: string;
  type: "image" | "text";
  mediaUrl?: string;
  caption?: string;
  bgColor?: string;
  viewedBy: string[];
  expiresAt: string;
  createdAt: string;
}

export interface UserSettings {
  showActiveStatus: boolean;
  readReceipts: boolean;
  soundEnabled: boolean;
  enterToSend: boolean;
  darkMode: boolean;
}

