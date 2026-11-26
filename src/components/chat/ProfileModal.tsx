"use client";

import { useRef, useState } from "react";
import {
  X,
  Camera,
  User,
  Settings,
  LogOut,
  Check,
  Loader2,
  Eye,
  Bell,
  CornerDownLeft,
  Moon,
  Radio,
} from "lucide-react";
import { ChatUser, UserSettings } from "@/types/chat";
import { Avatar } from "./Avatar";

interface ProfileModalProps {
  user: ChatUser;
  settings: UserSettings;
  onClose: () => void;
  onUpdateProfile: (updates: {
    name: string;
    bio: string;
    image?: string | null;
  }) => Promise<void>;
  onUpdateSettings: (next: UserSettings) => Promise<void>;
  onSignOut: () => void;
}

export function ProfileModal({
  user,
  settings,
  onClose,
  onUpdateProfile,
  onUpdateSettings,
  onSignOut,
}: ProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"profile" | "settings">("profile");
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "Hey there! I am using JapChat.");
  const [image, setImage] = useState<string | null>(user.image || null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  async function handleAvatarChange(file: File) {
    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImage(data.url);
        await onUpdateProfile({ name: name.trim() || user.name, bio, image: data.url });
      }
    } finally {
      setUploadingPic(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSavedMsg(false);
    try {
      await onUpdateProfile({ name: name.trim(), bio: bio.trim(), image });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function toggleSetting(key: keyof UserSettings) {
    const next = { ...settings, [key]: !settings[key] };
    onUpdateSettings(next);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Telegram-style Top Banner */}
        <div className="relative h-28 bg-gradient-to-r from-[#0084FF] via-[#5B5DFF] to-[#A033FF]">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/25 text-white hover:bg-black/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute -bottom-11 left-6 flex items-end gap-4">
            <div className="relative group">
              <div className="rounded-full p-1 bg-white dark:bg-zinc-900 shadow-lg">
                <Avatar name={name || user.name} image={image} size="lg" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarChange(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploadingPic}
                onClick={() => fileInputRef.current?.click()}
                title="Change Profile Picture"
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-zinc-900 cursor-pointer"
              >
                {uploadingPic ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* User Title + Tabs */}
        <div className="pt-13 px-6 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <h2 className="font-bold text-lg leading-tight">{name || user.name}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{user.email}</p>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setTab("profile")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                tab === "profile"
                  ? "bg-[#0084FF] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                tab === "settings"
                  ? "bg-[#0084FF] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {tab === "profile" ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF] resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {savedMsg ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Profile saved
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5">
              <SettingRow
                icon={<Radio className="w-4 h-4 text-emerald-500" />}
                title="Active Status"
                description="Show friends when you're online"
                enabled={settings.showActiveStatus}
                onToggle={() => toggleSetting("showActiveStatus")}
              />
              <SettingRow
                icon={<Eye className="w-4 h-4 text-[#0084FF]" />}
                title="Read Receipts"
                description="Let others see when you've read messages"
                enabled={settings.readReceipts}
                onToggle={() => toggleSetting("readReceipts")}
              />
              <SettingRow
                icon={<Bell className="w-4 h-4 text-amber-500" />}
                title="Notification Sounds"
                description="Play a chime for incoming messages"
                enabled={settings.soundEnabled}
                onToggle={() => toggleSetting("soundEnabled")}
              />
              <SettingRow
                icon={<CornerDownLeft className="w-4 h-4 text-purple-500" />}
                title="Enter to Send"
                description="Press Enter key to send messages"
                enabled={settings.enterToSend}
                onToggle={() => toggleSetting("enterToSend")}
              />
              <SettingRow
                icon={<Moon className="w-4 h-4 text-indigo-500" />}
                title="Dark Mode"
                description="Use dark appearance across JapChat"
                enabled={settings.darkMode}
                onToggle={() => toggleSetting("darkMode")}
              />

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition">
      <div className="flex items-center gap-3 min-w-0 pr-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
            {description}
          </div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
          enabled ? "bg-[#0084FF]" : "bg-slate-300 dark:bg-zinc-700"
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
