"use client";

import { useState } from "react";
import { Check, ChevronLeft, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Conversation } from "@/lib/conversationStorage";

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose: () => void;
}

export default function ConversationHistoryDrawer({
  isOpen,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onClose,
}: ConversationHistoryDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleStartRename(conv: Conversation) {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setConfirmDeleteId(null);
  }

  function handleSaveRename(id: string) {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  }

  function handleCancelRename() {
    setEditingId(null);
    setEditTitle("");
  }

  function handleConfirmDelete(id: string) {
    onDeleteConversation(id);
    setConfirmDeleteId(null);
  }

  return (
    <div className="absolute inset-0 z-40 flex bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="relative flex h-full w-[280px] max-w-[85%] flex-col border-r border-[#E5E5E0] dark:border-[#26262B] bg-[#FAFAF8] dark:bg-[#121316] p-3 text-[#171923] dark:text-[#F5F5F0] shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E0] dark:border-[#26262B]">
          <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide uppercase text-[#70736E] dark:text-[#A4A49C]">
            <MessageSquare size={14} />
            <span>Chat History</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewConversation}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#171923] dark:text-[#F5F5F0] bg-[#EAEFF9] dark:bg-[#1E2024] hover:bg-[#DFE3EF] dark:hover:bg-[#2A2C32] transition-colors"
              title="New Chat"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#70736E] hover:text-[#171923] dark:hover:text-white transition-colors"
              aria-label="Close history drawer"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-1 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#70736E] dark:text-[#A4A49C]">
              No previous chats yet.
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;
              const isDeleting = confirmDeleteId === conv.id;

              if (isEditing) {
                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-1 rounded-lg border border-[#6657D9] dark:border-[#E8FF70] p-1.5 bg-white dark:bg-[#181A18]"
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSaveRename(conv.id);
                        if (e.key === "Escape") handleCancelRename();
                      }}
                      className="flex-1 bg-transparent text-xs text-[#171923] dark:text-white outline-hidden"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(conv.id)}
                      className="p-1 text-emerald-500 hover:text-emerald-400"
                      title="Save"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="p-1 text-neutral-400 hover:text-neutral-300"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              }

              if (isDeleting) {
                return (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300"
                  >
                    <span>Delete chat?</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(conv.id)}
                        className="rounded px-2 py-0.5 bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-1.5 py-0.5 text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#EAEFF9] dark:bg-[#1E2024] font-medium text-[#171923] dark:text-[#E8FF70]"
                      : "text-[#555] dark:text-[#A0A0AA] hover:bg-[#F0F3FA] dark:hover:bg-[#181A1C] hover:text-[#171923] dark:hover:text-[#F5F5F0]"
                  }`}
                >
                  <span className="truncate pr-2">{conv.title}</span>

                  {/* Actions (visible on hover and always accessible on active conversation) */}
                  <div
                    className={`flex items-center gap-0.5 transition-opacity ${
                      isActive ? "opacity-80 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleStartRename(conv)}
                      className="p-1 text-[#70736E] hover:text-[#171923] dark:hover:text-white"
                      aria-label={`Rename "${conv.title}"`}
                      title="Rename"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(conv.id)}
                      className="p-1 text-[#70736E] hover:text-red-400"
                      aria-label={`Delete "${conv.title}"`}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Backdrop click dismisses drawer */}
      <div className="flex-1" onClick={onClose} />
    </div>
  );
}
