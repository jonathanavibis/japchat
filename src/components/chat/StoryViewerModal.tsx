"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { ChatStory } from "@/types/chat";
import { Avatar } from "./Avatar";

interface StoryViewerModalProps {
  stories: ChatStory[];
  currentUserId: string;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onDelete: (storyId: string) => Promise<void>;
}

export function StoryViewerModal({
  stories,
  currentUserId,
  onClose,
  onViewed,
  onDelete,
}: StoryViewerModalProps) {
  const [index, setIndex] = useState(0);
  const current = stories[index];

  useEffect(() => {
    if (!current) return;
    if (!current.viewedBy.includes(currentUserId)) {
      onViewed(current._id);
    }
  }, [current, currentUserId, onViewed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (index < stories.length - 1) {
        setIndex((i) => i + 1);
      } else {
        onClose();
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [index, stories.length, onClose]);

  if (!current) return null;

  const isOwn = current.userId === currentUserId;
  const timeAgo = new Date(current.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm h-[82vh] max-h-[680px] rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl flex flex-col"
      >
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {stories.map((s, i) => (
            <div
              key={s._id}
              className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className={`h-full bg-white transition-all ${
                  i < index ? "w-full" : i === index ? "w-full duration-[6000ms] ease-linear" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={current.userName}
              image={current.userImage}
              size="sm"
            />
            <div className="text-white drop-shadow">
              <div className="text-sm font-semibold leading-tight">
                {current.userName}
              </div>
              <div className="text-[11px] text-white/80">{timeAgo}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isOwn && (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(current._id);
                  if (stories.length <= 1) onClose();
                  else setIndex((i) => Math.max(0, i - 1));
                }}
                className="p-1.5 rounded-full bg-black/40 text-white hover:bg-red-600/80 transition cursor-pointer"
                title="Delete Story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Story Body */}
        {current.type === "image" && current.mediaUrl ? (
          <div className="relative flex-1 bg-black flex items-center justify-center">
            <img
              src={current.mediaUrl}
              alt={current.caption || "Story"}
              className="w-full h-full object-contain"
            />
            {current.caption && (
              <div className="absolute bottom-12 left-4 right-4 bg-black/55 backdrop-blur-xs text-white text-sm text-center px-4 py-2.5 rounded-2xl">
                {current.caption}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`flex-1 bg-gradient-to-br ${
              current.bgColor || "from-[#0084FF] via-[#6B4DFF] to-[#A033FF]"
            } p-8 flex items-center justify-center`}
          >
            <p className="text-white text-xl font-bold text-center whitespace-pre-wrap break-words drop-shadow">
              {current.caption}
            </p>
          </div>
        )}

        {/* Footer views count */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-white/85 text-xs">
          <span className="inline-flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-full">
            <Eye className="w-3.5 h-3.5" />
            {current.viewedBy.length} views
          </span>
        </div>

        {/* Prev / Next Click Zones */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/35 text-white hover:bg-black/60 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {index < stories.length - 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/35 text-white hover:bg-black/60 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
