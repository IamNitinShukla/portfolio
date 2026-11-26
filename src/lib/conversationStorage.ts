/**
 * Temporary Chat State & Utilities for Friday AI Assistant
 *
 * NOTE: Persistent conversation storage (localStorage, sessionStorage, IndexedDB)
 * is strictly disabled. All conversations are temporary and kept in React state only.
 */

export interface Message {
  id?: string;
  sender: "assistant" | "user";
  text: string;
  timestamp?: number;
  isStreaming?: boolean;
  isFallback?: boolean;
  sources?: Array<{ title: string; url: string }>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

const STORAGE_KEY = "friday_conversations_v1";
const ACTIVE_CONV_KEY = "friday_active_conversation_id";

export const DEFAULT_WELCOME_MESSAGE: Message = {
  id: "msg_welcome_default",
  sender: "assistant",
  text: "Hello! I'm Friday, Nitin Sir's personal AI assistant. I can help you explore his projects, technical skills, experience, and answer general questions.",
  timestamp: Date.now(),
};

/** Generates a unique collision-resistant ID */
export function generateId(prefix = "msg"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Automatically creates a concise, human-readable title from the first message.
 */
export function generateTitleFromMessage(userMessage: string): string {
  const cleaned = userMessage
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "New Conversation";

  const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (formatted.length <= 36) return formatted;
  const truncated = formatted.substring(0, 34);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 18 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

/** Creates a fresh, empty in-memory conversation */
export function createNewConversation(customTitle?: string): Conversation {
  const now = Date.now();
  return {
    id: generateId("conv"),
    title: customTitle || "New Conversation",
    createdAt: now,
    updatedAt: now,
    messages: [{ ...DEFAULT_WELCOME_MESSAGE, id: generateId("msg"), timestamp: now }],
  };
}

/**
 * Persistence is disabled: always returns an empty array.
 * Cleans up any legacy storage entries in the user's browser.
 */
export function getStoredConversations(): Conversation[] {
  purgeLegacyStorage();
  return [];
}

/**
 * Persistence is disabled: no-op to ensure nothing is written to localStorage.
 */
export function saveConversations(_conversations: Conversation[]): void {
  // Persistence disabled: intentional no-op
}

/**
 * Persistence is disabled: always returns null.
 */
export function getActiveConversationId(): string | null {
  return null;
}

/**
 * Persistence is disabled: no-op.
 */
export function setActiveConversationId(_id: string): void {
  // Persistence disabled: intentional no-op
}

/**
 * Purges any legacy conversation entries from localStorage.
 */
export function purgeLegacyStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_CONV_KEY);
    localStorage.removeItem("friday_conversations");
  } catch {
    // Ignore storage errors in private mode
  }
}

/** Pure in-memory upsert helper */
export function upsertConversation(
  list: Conversation[],
  updated: Conversation
): Conversation[] {
  const index = list.findIndex(c => c.id === updated.id);
  if (index === -1) {
    return [updated, ...list];
  }
  const copy = [...list];
  copy[index] = updated;
  return copy;
}

/** Pure in-memory rename helper */
export function renameConversation(
  list: Conversation[],
  id: string,
  newTitle: string
): Conversation[] {
  return list.map(c => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c));
}

/** Pure in-memory delete helper */
export function deleteConversation(
  list: Conversation[],
  id: string
): Conversation[] {
  return list.filter(c => c.id !== id);
}
