"use client";

import { useState } from "react";
import { X, Check, Users, Loader2 } from "lucide-react";
import { ChatUser } from "@/types/chat";
import { Avatar } from "./Avatar";

interface NewGroupModalProps {
  users: ChatUser[];
  onClose: () => void;
  onCreate: (name: string, participantIds: string[]) => Promise<void>;
}

export function NewGroupModal({ users, onClose, onCreate }: NewGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleUser(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await onCreate(groupName.trim(), selectedIds);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#0084FF]/10 text-[#0084FF] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-base">Create Group Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Weekend Hangout"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0084FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Members ({selectedIds.length} selected)
            </label>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {users.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No other users found yet.
                </p>
              ) : (
                users.map((u) => {
                  const isSelected = selectedIds.includes(u.id);
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                        isSelected
                          ? "bg-[#0084FF]/10 dark:bg-[#0084FF]/20"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} image={u.image} size="sm" />
                        <div className="text-left">
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                          isSelected
                            ? "bg-[#0084FF] border-[#0084FF] text-white"
                            : "border-slate-300 dark:border-zinc-600"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !groupName.trim() || selectedIds.length === 0}
              className="px-5 py-2 rounded-xl bg-[#0084FF] hover:bg-[#0073E6] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
