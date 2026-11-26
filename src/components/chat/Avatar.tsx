"use client";

import { Users } from "lucide-react";

interface AvatarProps {
  name: string;
  image?: string | null;
  online?: boolean;
  isGroup?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-12 h-12 text-base",
};

const dotMap = {
  sm: "w-2.5 h-2.5 border-[1.5px]",
  md: "w-3 h-3 border-2",
  lg: "w-3.5 h-3.5 border-2",
};

const colors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function pickColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  name,
  image,
  online = false,
  isGroup = false,
  size = "md",
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {image ? (
        <img
          src={image}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover bg-slate-200 dark:bg-zinc-800`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} ${
            isGroup ? "bg-gradient-to-tr from-[#0084FF] to-[#A033FF]" : pickColor(name)
          } rounded-full flex items-center justify-center text-white font-semibold select-none`}
        >
          {isGroup ? <Users className="w-5 h-5" /> : initials || "U"}
        </div>
      )}
      {online && !isGroup && (
        <span
          className={`absolute bottom-0 right-0 ${dotMap[size]} rounded-full bg-emerald-500 border-white dark:border-zinc-900`}
        />
      )}
    </div>
  );
}
