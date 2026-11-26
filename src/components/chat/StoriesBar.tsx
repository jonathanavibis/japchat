"use client";

import { Plus } from "lucide-react";
import { ChatStory, ChatUser } from "@/types/chat";
import { Avatar } from "./Avatar";

interface StoriesBarProps {
  currentUser: ChatUser;
  stories: ChatStory[];
  onOpenCreate: () => void;
  onOpenViewer: (userStories: ChatStory[]) => void;
}

export function StoriesBar({
  currentUser,
  stories,
  onOpenCreate,
  onOpenViewer,
}: StoriesBarProps) {
  // Group stories by userId
  const grouped = stories.reduce<Record<string, ChatStory[]>>((acc, s) => {
    if (!acc[s.userId]) acc[s.userId] = [];
    acc[s.userId].push(s);
    return acc;
  }, {});

  const myStories = grouped[currentUser.id] || [];
  const otherUsersStories = Object.entries(grouped).filter(
    ([uid]) => uid !== currentUser.id
  );

  return (
    <div className="px-3 pb-2.5 pt-1 border-b border-slate-100 dark:border-zinc-800/80">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {/* Your Story */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                myStories.length > 0 ? onOpenViewer(myStories) : onOpenCreate()
              }
              className={`rounded-full p-[2.5px] cursor-pointer ${
                myStories.length > 0
                  ? "bg-gradient-to-tr from-[#0084FF] via-[#6B4DFF] to-[#A033FF]"
                  : "bg-slate-200 dark:bg-zinc-800"
              }`}
            >
              <div className="rounded-full p-[2px] bg-white dark:bg-zinc-950">
                <Avatar
                  name={currentUser.name}
                  image={currentUser.image}
                  size="md"
                />
              </div>
            </button>
            <button
              type="button"
              onClick={onOpenCreate}
              title="Add Story"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white flex items-center justify-center border-2 border-white dark:border-zinc-950 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[11px] text-slate-600 dark:text-zinc-400 max-w-[56px] truncate">
            Your story
          </span>
        </div>

        {/* Friends' Stories */}
        {otherUsersStories.map(([uid, userStories]) => {
          const latest = userStories[0];
          const hasUnseen = userStories.some(
            (s) => !s.viewedBy.includes(currentUser.id)
          );
          return (
            <button
              key={uid}
              type="button"
              onClick={() => onOpenViewer(userStories)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            >
              <div
                className={`rounded-full p-[2.5px] ${
                  hasUnseen
                    ? "bg-gradient-to-tr from-[#0084FF] via-[#6B4DFF] to-[#A033FF]"
                    : "bg-slate-300 dark:bg-zinc-700"
                }`}
              >
                <div className="rounded-full p-[2px] bg-white dark:bg-zinc-950">
                  <Avatar
                    name={latest.userName}
                    image={latest.userImage}
                    size="md"
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-zinc-400 max-w-[56px] truncate">
                {latest.userName.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
