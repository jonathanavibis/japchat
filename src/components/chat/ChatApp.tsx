"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Square,
  Search,
  Users,
  LogOut,
  Check,
  CheckCheck,
  Reply,
  X,
  FileText,
  Download,
  Smile,
  ArrowLeft,
  ThumbsUp,
  MessageCircle,
  Trash2,
  Settings,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  ChatConversation,
  ChatMessage,
  ChatStory,
  ChatUser,
  ReplyPreview,
  UserSettings,
} from "@/types/chat";
import { Avatar } from "./Avatar";
import { NewGroupModal } from "./NewGroupModal";
import { ProfileModal } from "./ProfileModal";
import { StoriesBar } from "./StoriesBar";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewerModal } from "./StoryViewerModal";

interface ChatAppProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec?: number) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChatApp({ currentUser }: ChatAppProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingByConv, setTypingByConv] = useState<
    Record<string, { userId: string; userName: string }[]>
  >({});

  const [searchQuery, setSearchQuery] = useState("");
  const [textInput, setTextInput] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(
    null
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<ChatUser>({
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    image: currentUser.image,
  });
  const [settings, setSettings] = useState<UserSettings>({
    showActiveStatus: true,
    readReceipts: true,
    soundEnabled: true,
    enterToSend: true,
    darkMode: false,
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewerStories, setViewerStories] = useState<ChatStory[] | null>(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c._id === activeConvId) || null,
    [conversations, activeConvId]
  );

  const activeMessages = useMemo(
    () => (activeConvId ? messagesByConv[activeConvId] || [] : []),
    [messagesByConv, activeConvId]
  );

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}/messages?limit=60`);
    if (res.ok) {
      const data = await res.json();
      setMessagesByConv((prev) => ({
        ...prev,
        [convId]: data.messages || [],
      }));
    }
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

  // Initial data load
  useEffect(() => {
    let active = true;
    (async () => {
      const [convRes, usersRes, meRes, storiesRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch("/api/users"),
        fetch("/api/users/me"),
        fetch("/api/stories"),
      ]);
      if (!active) return;
      if (convRes.ok) {
        const data = await convRes.json();
        setConversations(data.conversations || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.user) setProfileUser(data.user);
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      }
      if (storiesRes.ok) {
        const data = await storiesRes.json();
        setStories(data.stories || []);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Socket.io setup
  useEffect(() => {
    const socket = io({
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("presence:list", ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(ids));
    });

    socket.on(
      "presence:update",
      ({ userId, online }: { userId: string; online: boolean }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (online) next.add(userId);
          else next.delete(userId);
          return next;
        });
      }
    );

    socket.on("message:new", (msg: ChatMessage) => {
      setMessagesByConv((prev) => {
        const list = prev[msg.conversationId] || [];
        if (list.some((m) => m._id === msg._id)) return prev;
        return {
          ...prev,
          [msg.conversationId]: [...list, msg],
        };
      });

      // If this conversation is currently open, mark as seen
      if (
        msg.senderId !== currentUser.id &&
        activeConvId === msg.conversationId
      ) {
        socket.emit("message:seen", { conversationId: msg.conversationId });
      }
    });

    socket.on(
      "conversation:updated",
      ({
        conversationId,
        lastMessage,
        updatedAt,
      }: {
        conversationId: string;
        lastMessage: ChatConversation["lastMessage"];
        updatedAt: string;
      }) => {
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === conversationId);
          if (!exists) {
            fetchConversations();
            return prev;
          }
          const updated = prev.map((c) => {
            if (c._id !== conversationId) return c;
            const isIncomingUnread =
              lastMessage &&
              lastMessage.senderId !== currentUser.id &&
              activeConvId !== conversationId;
            return {
              ...c,
              lastMessage,
              updatedAt,
              unreadCount: isIncomingUnread ? c.unreadCount + 1 : c.unreadCount,
            };
          });
          return [...updated].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      }
    );

    socket.on(
      "typing:update",
      ({
        conversationId,
        userId,
        userName,
        isTyping,
      }: {
        conversationId: string;
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => {
        if (userId === currentUser.id) return;
        setTypingByConv((prev) => {
          const current = prev[conversationId] || [];
          const filtered = current.filter((t) => t.userId !== userId);
          return {
            ...prev,
            [conversationId]: isTyping
              ? [...filtered, { userId, userName }]
              : filtered,
          };
        });
      }
    );

    socket.on(
      "message:delivered",
      ({ conversationId, userId }: { conversationId: string; userId: string }) => {
        setMessagesByConv((prev) => {
          const list = prev[conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [conversationId]: list.map((m) =>
              m.deliveredTo.includes(userId)
                ? m
                : { ...m, deliveredTo: [...m.deliveredTo, userId] }
            ),
          };
        });
      }
    );

    socket.on(
      "message:seen_update",
      ({
        conversationId,
        userId,
        seenAt,
      }: {
        conversationId: string;
        userId: string;
        seenAt: string;
      }) => {
        setMessagesByConv((prev) => {
          const list = prev[conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [conversationId]: list.map((m) => {
              if (m.seenBy.some((s) => s.userId === userId)) return m;
              return {
                ...m,
                deliveredTo: m.deliveredTo.includes(userId)
                  ? m.deliveredTo
                  : [...m.deliveredTo, userId],
                seenBy: [...m.seenBy, { userId, seenAt }],
              };
            }),
          };
        });
      }
    );

    socket.on(
      "message:reaction_update",
      ({
        messageId,
        conversationId,
        reactions,
      }: {
        messageId: string;
        conversationId: string;
        reactions: ChatMessage["reactions"];
      }) => {
        setMessagesByConv((prev) => {
          const list = prev[conversationId];
          if (!list) return prev;
          return {
            ...prev,
            [conversationId]: list.map((m) =>
              m._id === messageId ? { ...m, reactions } : m
            ),
          };
        });
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [currentUser.id, activeConvId, fetchConversations]);

  // Serverless polling fallback when Socket.io is not connected (e.g. on Vercel)
  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current?.connected) return;
      fetchConversations();
      if (activeConvId) {
        fetchMessages(activeConvId);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvId, fetchConversations, fetchMessages]);

  // Select a conversation
  const openConversation = useCallback(
    async (convId: string) => {
      setActiveConvId(convId);
      setReplyTo(null);
      setActiveReactionMsgId(null);
      socketRef.current?.emit("conversation:join", { conversationId: convId });
      await fetchMessages(convId);
      if (socketRef.current?.connected) {
        socketRef.current.emit("message:seen", { conversationId: convId });
      } else {
        fetch(`/api/conversations/${convId}/seen`, { method: "POST" });
      }
      setConversations((prev) =>
        prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
      );
    },
    [fetchMessages]
  );

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeConvId]);

  // Start 1-on-1 chat with a user
  async function startDirectChat(userId: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: userId }),
    });
    if (res.ok) {
      const data = await res.json();
      const conv: ChatConversation = data.conversation;
      setConversations((prev) => {
        if (prev.some((c) => c._id === conv._id)) return prev;
        return [conv, ...prev];
      });
      setSearchQuery("");
      await openConversation(conv._id);
    }
  }

  // Create group chat
  async function handleCreateGroup(name: string, participantIds: string[]) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGroup: true, name, participantIds }),
    });
    if (res.ok) {
      const data = await res.json();
      const conv: ChatConversation = data.conversation;
      setConversations((prev) => [conv, ...prev]);
      await openConversation(conv._id);
    }
  }

  // Unified send helper (Socket.io when connected, REST fallback on serverless)
  async function dispatchMessage(payload: {
    conversationId: string;
    type: "text" | "image" | "file" | "audio";
    text?: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    audioDuration?: number;
    replyTo?: ReplyPreview;
  }) {
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:send", payload);
      return;
    }
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      const msg: ChatMessage = data.message;
      setMessagesByConv((prev) => {
        const list = prev[msg.conversationId] || [];
        if (list.some((m) => m._id === msg._id)) return prev;
        return { ...prev, [msg.conversationId]: [...list, msg] };
      });
      fetchConversations();
    }
  }

  // Send text message
  function sendTextMessage(customText?: string) {
    const text = (customText ?? textInput).trim();
    if (!text || !activeConvId) return;

    dispatchMessage({
      conversationId: activeConvId,
      type: "text",
      text,
      replyTo: replyTo || undefined,
    });

    if (!customText) setTextInput("");
    setReplyTo(null);
    socketRef.current?.emit("typing:stop", { conversationId: activeConvId });
  }

  // Handle typing
  function handleInputChange(value: string) {
    setTextInput(value);
    if (!activeConvId || !socketRef.current?.connected) return;

    socketRef.current.emit("typing:start", { conversationId: activeConvId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: activeConvId });
    }, 1500);
  }

  // Upload image or file
  async function handleFileUpload(file: File) {
    if (!activeConvId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        await dispatchMessage({
          conversationId: activeConvId,
          type: data.kind,
          mediaUrl: data.url,
          fileName: data.fileName,
          fileSize: data.fileSize,
          replyTo: replyTo || undefined,
        });
        setReplyTo(null);
      }
    } finally {
      setUploading(false);
    }
  }

  // Voice note recording
  async function startRecording() {
    if (!activeConvId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setRecordSeconds(0);
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      };

      recorder.start();
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  }

  function stopAndSendRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !activeConvId) return;

    const duration = recordSeconds;
    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);

      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      if (blob.size === 0) return;

      const file = new File([blob], `voice-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          await dispatchMessage({
            conversationId: activeConvId,
            type: "audio",
            mediaUrl: data.url,
            fileName: data.fileName,
            fileSize: data.fileSize,
            audioDuration: duration,
          });
        }
      } finally {
        setUploading(false);
      }
    };
    recorder.stop();
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setRecordSeconds(0);
    };
    recorder.stop();
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setActiveReactionMsgId(null);
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:react", { messageId, emoji });
      return;
    }
    const res = await fetch(`/api/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok && activeConvId) {
      const data = await res.json();
      setMessagesByConv((prev) => ({
        ...prev,
        [activeConvId]: (prev[activeConvId] || []).map((m) =>
          m._id === messageId ? { ...m, reactions: data.reactions } : m
        ),
      }));
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  function getConvMeta(conv: ChatConversation) {
    if (conv.isGroup) {
      return {
        title: conv.name || "Group Chat",
        image: conv.avatar,
        online: false,
        subtitle: `${conv.participants.length} members`,
      };
    }
    const other =
      conv.participantDetails.find((p) => p.id !== currentUser.id) ||
      conv.participantDetails[0];
    const isOnline = other ? onlineUserIds.has(other.id) : false;
    return {
      title: other?.name || "Unknown User",
      image: other?.image,
      online: isOnline,
      subtitle: isOnline ? "Active now" : "Offline",
    };
  }

  // Filter conversations & users by searchQuery
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const meta = getConvMeta(c);
      return meta.title.toLowerCase().includes(q);
    });
  }, [conversations, searchQuery, onlineUserIds]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const activeTyping = activeConvId ? typingByConv[activeConvId] || [] : [];

  return (
    <div className="h-screen w-full flex bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={`${
          activeConvId ? "hidden md:flex" : "flex"
        } w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0`}
      >
        {/* Top Bar */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            title="Open Profile & Settings"
            className="flex items-center gap-3 min-w-0 text-left hover:bg-slate-100 dark:hover:bg-zinc-900 p-1.5 -ml-1.5 rounded-2xl transition cursor-pointer"
          >
            <Avatar
              name={profileUser.name}
              image={profileUser.image}
              online={settings.showActiveStatus}
              size="md"
            />
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">
                Chats
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {profileUser.name}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowProfileModal(true)}
              title="Profile & Settings"
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              title="New Group Chat"
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-zinc-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Messenger or people..."
              className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
            />
          </div>
        </div>

        {/* Facebook-style Stories Bar */}
        <StoriesBar
          currentUser={profileUser}
          stories={stories}
          onOpenCreate={() => setShowCreateStory(true)}
          onOpenViewer={(userStories) => setViewerStories(userStories)}
        />

        {/* Conversations + People */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {filteredConversations.map((conv) => {
            const meta = getConvMeta(conv);
            const isActive = conv._id === activeConvId;
            const isOwnLast =
              conv.lastMessage?.senderId === currentUser.id;
            return (
              <button
                key={conv._id}
                onClick={() => openConversation(conv._id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition text-left cursor-pointer ${
                  isActive
                    ? "bg-[#0084FF]/10 dark:bg-[#0084FF]/20"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
              >
                <Avatar
                  name={meta.title}
                  image={meta.image}
                  online={meta.online}
                  isGroup={conv.isGroup}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">
                      {meta.title}
                    </span>
                    {conv.lastMessage?.createdAt && (
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        conv.unreadCount > 0
                          ? "font-semibold text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {conv.lastMessage
                        ? `${isOwnLast ? "You: " : ""}${conv.lastMessage.text}`
                        : "Start a conversation"}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 min-w-[20px] text-center rounded-full bg-[#0084FF] text-white text-[10px] font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* People Directory */}
          <div className="pt-4 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              People ({filteredUsers.length})
            </p>
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No other users yet.</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => {
                  const online = onlineUserIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => startDirectChat(u.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition text-left cursor-pointer"
                    >
                      <Avatar
                        name={u.name}
                        image={u.image}
                        online={online}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {online ? "Active now" : u.email}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Pane */}
      <main
        className={`${
          activeConvId ? "flex" : "hidden md:flex"
        } flex-1 flex-col bg-white dark:bg-zinc-950 min-w-0`}
      >
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#0084FF] to-[#A033FF] flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-5">
              <MessageCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold">Your JapChat Messenger</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mt-2">
              Select a conversation from the left or click any person under
              People to start chatting in real time.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            {(() => {
              const meta = getConvMeta(activeConv);
              return (
                <header className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setActiveConvId(null)}
                      className="md:hidden p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Avatar
                      name={meta.title}
                      image={meta.image}
                      online={meta.online}
                      isGroup={activeConv.isGroup}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base truncate">
                        {meta.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {activeTyping.length > 0
                          ? `${activeTyping.map((t) => t.userName).join(", ")} typing...`
                          : meta.subtitle}
                      </p>
                    </div>
                  </div>
                </header>
              );
            })()}

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50 dark:bg-zinc-950"
              onClick={() => setActiveReactionMsgId(null)}
            >
              {activeMessages.map((msg) => {
                const isOwn = msg.senderId === currentUser.id;
                const otherSeen = msg.seenBy.filter(
                  (s) => s.userId !== msg.senderId
                );
                const otherDelivered = msg.deliveredTo.filter(
                  (id) => id !== msg.senderId
                );

                // Group reactions by emoji
                const reactionGroups = msg.reactions.reduce<
                  Record<string, { count: number; byMe: boolean }>
                >((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = { count: 0, byMe: false };
                  acc[r.emoji].count += 1;
                  if (r.userId === currentUser.id) acc[r.emoji].byMe = true;
                  return acc;
                }, {});

                return (
                  <div
                    key={msg._id}
                    className={`group flex flex-col ${
                      isOwn ? "items-end" : "items-start"
                    }`}
                  >
                    {activeConv.isGroup && !isOwn && (
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 ml-11 mb-0.5">
                        {msg.senderName}
                      </span>
                    )}

                    <div
                      className={`flex items-end gap-2 max-w-[82%] sm:max-w-[70%] ${
                        isOwn ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {!isOwn && (
                        <Avatar
                          name={msg.senderName}
                          image={msg.senderImage}
                          size="sm"
                        />
                      )}

                      <div className="relative">
                        {/* Hover actions */}
                        <div
                          className={`opacity-0 group-hover:opacity-100 transition flex items-center gap-1 absolute top-1/2 -translate-y-1/2 z-10 ${
                            isOwn ? "-left-16" : "-right-16"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionMsgId(
                                activeReactionMsgId === msg._id ? null : msg._id
                              );
                            }}
                            className="p-1.5 rounded-full bg-white dark:bg-zinc-800 shadow border border-slate-200 dark:border-zinc-700 hover:scale-110 transition cursor-pointer"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTo({
                                messageId: msg._id,
                                text:
                                  msg.type === "text"
                                    ? msg.text || ""
                                    : `[${msg.type}]`,
                                senderName: msg.senderName,
                                type: msg.type,
                              })
                            }
                            className="p-1.5 rounded-full bg-white dark:bg-zinc-800 shadow border border-slate-200 dark:border-zinc-700 hover:scale-110 transition cursor-pointer"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        </div>

                        {/* Emoji picker popover */}
                        {activeReactionMsgId === msg._id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute -top-11 z-20 flex items-center gap-1 bg-white dark:bg-zinc-800 rounded-full px-2.5 py-1.5 shadow-xl border border-slate-200 dark:border-zinc-700 ${
                              isOwn ? "right-0" : "left-0"
                            }`}
                          >
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => toggleReaction(msg._id, emoji)}
                                className="text-lg hover:scale-125 transition px-0.5 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm shadow-xs ${
                            isOwn
                              ? "bg-[#0084FF] text-white rounded-br-sm"
                              : "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-100 dark:border-zinc-700/60 rounded-bl-sm"
                          }`}
                        >
                          {/* Reply preview */}
                          {msg.replyTo && (
                            <div
                              className={`mb-1.5 px-2.5 py-1.5 rounded-xl text-xs border-l-2 ${
                                isOwn
                                  ? "bg-white/15 border-white/60 text-white/90"
                                  : "bg-slate-100 dark:bg-zinc-700/60 border-[#0084FF] text-slate-600 dark:text-zinc-300"
                              }`}
                            >
                              <div className="font-semibold">
                                {msg.replyTo.senderName}
                              </div>
                              <div className="truncate">{msg.replyTo.text}</div>
                            </div>
                          )}

                          {/* Content by type */}
                          {msg.type === "text" && (
                            <p className="whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}

                          {msg.type === "image" && msg.mediaUrl && (
                            <img
                              src={msg.mediaUrl}
                              alt={msg.fileName || "Image"}
                              onClick={() => setLightboxUrl(msg.mediaUrl!)}
                              className="max-w-[260px] max-h-[260px] rounded-xl object-cover cursor-pointer hover:opacity-95"
                            />
                          )}

                          {msg.type === "audio" && msg.mediaUrl && (
                            <div className="flex flex-col gap-1 min-w-[210px]">
                              <audio
                                controls
                                src={msg.mediaUrl}
                                className="h-8 w-full max-w-[240px]"
                              />
                              {msg.audioDuration !== undefined && (
                                <span
                                  className={`text-[10px] ${
                                    isOwn ? "text-blue-100" : "text-slate-400"
                                  }`}
                                >
                                  Voice note • {formatDuration(msg.audioDuration)}
                                </span>
                              )}
                            </div>
                          )}

                          {msg.type === "file" && msg.mediaUrl && (
                            <a
                              href={msg.mediaUrl}
                              download={msg.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2.5 p-2 rounded-xl ${
                                isOwn
                                  ? "bg-white/15 hover:bg-white/20"
                                  : "bg-slate-100 dark:bg-zinc-700/60 hover:bg-slate-200 dark:hover:bg-zinc-700"
                              } transition`}
                            >
                              <FileText className="w-5 h-5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">
                                  {msg.fileName || "Attachment"}
                                </div>
                                <div className="text-[10px] opacity-75">
                                  {formatFileSize(msg.fileSize)}
                                </div>
                              </div>
                              <Download className="w-4 h-4 shrink-0" />
                            </a>
                          )}
                        </div>

                        {/* Reaction pills */}
                        {Object.keys(reactionGroups).length > 0 && (
                          <div
                            className={`flex flex-wrap gap-1 mt-1 ${
                              isOwn ? "justify-end" : "justify-start"
                            }`}
                          >
                            {Object.entries(reactionGroups).map(
                              ([emoji, info]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(msg._id, emoji)}
                                  className={`text-xs px-1.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-0.5 cursor-pointer ${
                                    info.byMe
                                      ? "bg-[#0084FF]/15 border-[#0084FF]/40"
                                      : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  {info.count > 1 && (
                                    <span className="text-[10px] font-semibold">
                                      {info.count}
                                    </span>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Time + Read Receipt */}
                    <div
                      className={`flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 ${
                        isOwn ? "mr-1" : "ml-10"
                      }`}
                    >
                      <span>{formatTime(msg.createdAt)}</span>
                      {isOwn && (
                        <>
                          {otherSeen.length > 0 ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-[#0084FF] font-medium"
                              title="Seen"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              Seen
                            </span>
                          ) : otherDelivered.length > 0 ? (
                            <span title="Delivered">
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            </span>
                          ) : (
                            <span title="Sent">
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing bubble */}
              {activeTyping.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/60 rounded-2xl px-4 py-2.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Reply banner */}
            {replyTo && (
              <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-[#0084FF]">
                    Replying to {replyTo.senderName}:{" "}
                  </span>
                  <span className="text-slate-600 dark:text-zinc-400 truncate">
                    {replyTo.text}
                  </span>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Composer */}
            <div className="px-3 py-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-full px-4 py-2">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    Recording voice note... {formatDuration(recordSeconds)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 cursor-pointer"
                      title="Cancel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendRecording}
                      className="px-3 py-1 rounded-full bg-[#0084FF] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => imageInputRef.current?.click()}
                    title="Send Photo"
                    className="p-2 rounded-full text-[#0084FF] hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach File"
                    className="p-2 rounded-full text-[#0084FF] hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={startRecording}
                    title="Record Voice Note"
                    className="p-2 rounded-full text-[#0084FF] hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (settings.enterToSend && e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendTextMessage();
                      }
                    }}
                    placeholder={
                      uploading ? "Uploading attachment..." : "Aa"
                    }
                    className="flex-1 px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
                  />

                  {textInput.trim() ? (
                    <button
                      type="button"
                      onClick={() => sendTextMessage()}
                      className="p-2.5 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white transition cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendTextMessage("👍")}
                      title="Send Like"
                      className="p-2 rounded-full text-[#0084FF] hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <ThumbsUp className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* New Group Modal */}
      {showGroupModal && (
        <NewGroupModal
          users={users}
          onClose={() => setShowGroupModal(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {/* Telegram-style Profile & Settings Pop-Up */}
      {showProfileModal && (
        <ProfileModal
          user={profileUser}
          settings={settings}
          onClose={() => setShowProfileModal(false)}
          onUpdateProfile={async (updates) => {
            const res = await fetch("/api/users/me", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user) setProfileUser(data.user);
            }
          }}
          onUpdateSettings={async (next) => {
            setSettings(next);
            await fetch("/api/users/me", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ settings: next }),
            });
          }}
          onSignOut={handleSignOut}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <CreateStoryModal
          onClose={() => setShowCreateStory(false)}
          onCreate={async (payload) => {
            const res = await fetch("/api/stories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              const data = await res.json();
              setStories((prev) => [data.story, ...prev]);
            }
          }}
        />
      )}

      {/* Story Viewer Modal */}
      {viewerStories && (
        <StoryViewerModal
          stories={viewerStories}
          currentUserId={currentUser.id}
          onClose={() => setViewerStories(null)}
          onViewed={async (storyId) => {
            await fetch(`/api/stories/${storyId}/view`, { method: "POST" });
            setStories((prev) =>
              prev.map((s) =>
                s._id === storyId && !s.viewedBy.includes(currentUser.id)
                  ? { ...s, viewedBy: [...s.viewedBy, currentUser.id] }
                  : s
              )
            );
          }}
          onDelete={async (storyId) => {
            const res = await fetch(`/api/stories/${storyId}`, {
              method: "DELETE",
            });
            if (res.ok) {
              setStories((prev) => prev.filter((s) => s._id !== storyId));
              setViewerStories((prev) =>
                prev ? prev.filter((s) => s._id !== storyId) : null
              );
            }
          }}
        />
      )}

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
