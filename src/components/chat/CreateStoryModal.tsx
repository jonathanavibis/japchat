"use client";

import { useRef, useState } from "react";
import { X, Image as ImageIcon, Type, Loader2, Sparkles } from "lucide-react";

interface CreateStoryModalProps {
  onClose: () => void;
  onCreate: (payload: {
    type: "image" | "text";
    mediaUrl?: string;
    caption?: string;
    bgColor?: string;
  }) => Promise<void>;
}

const GRADIENTS = [
  "from-[#0084FF] via-[#6B4DFF] to-[#A033FF]",
  "from-rose-500 via-pink-500 to-amber-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-indigo-600 via-purple-600 to-pink-500",
  "from-zinc-800 via-zinc-900 to-black",
];

export function CreateStoryModal({ onClose, onCreate }: CreateStoryModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [caption, setCaption] = useState("");
  const [bgColor, setBgColor] = useState(GRADIENTS[0]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleImageSelect(file: File) {
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
        setMediaUrl(data.url);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "text" && !caption.trim()) return;
    if (mode === "image" && !mediaUrl) return;

    setSubmitting(true);
    try {
      await onCreate({
        type: mode,
        mediaUrl: mode === "image" ? mediaUrl || undefined : undefined,
        caption: caption.trim() || undefined,
        bgColor,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0084FF]" />
            <h2 className="font-semibold text-base">Create Story (24h)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode Switch */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "text"
                  ? "bg-[#0084FF] text-white"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
              }`}
            >
              <Type className="w-4 h-4" />
              Text Story
            </button>
            <button
              type="button"
              onClick={() => setMode("image")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "image"
                  ? "bg-[#0084FF] text-white"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Photo Story
            </button>
          </div>

          {mode === "text" ? (
            <>
              <div
                className={`h-56 rounded-2xl bg-gradient-to-br ${bgColor} p-6 flex items-center justify-center shadow-inner`}
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={250}
                  placeholder="Start typing your story..."
                  className="w-full bg-transparent text-white placeholder-white/70 text-center text-lg font-semibold focus:outline-none resize-none"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-center gap-2.5">
                {GRADIENTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setBgColor(g)}
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} cursor-pointer transition ${
                      bgColor === g
                        ? "ring-2 ring-offset-2 ring-[#0084FF] scale-110"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelect(f);
                  e.target.value = "";
                }}
              />
              {mediaUrl ? (
                <div className="relative h-60 rounded-2xl overflow-hidden bg-black">
                  <img
                    src={mediaUrl}
                    alt="Story preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 cursor-pointer"
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-52 rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-[#0084FF] hover:text-[#0084FF] transition cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <ImageIcon className="w-8 h-8" />
                  )}
                  <span className="text-sm font-medium">
                    {uploading ? "Uploading..." : "Click to upload a photo"}
                  </span>
                </button>
              )}

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={200}
                placeholder="Add a caption (optional)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                uploading ||
                (mode === "text" ? !caption.trim() : !mediaUrl)
              }
              className="px-5 py-2 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Share Story
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
