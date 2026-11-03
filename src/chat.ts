// In-game chat for online rooms.
//
// Chat piggybacks on the existing lobby document: the panel writes a `chat`
// field through the same /api/room endpoint the game already uses, and the
// regular lobby poll delivers incoming messages to both players. No new
// endpoints, no Firebase SDK on the client — this keeps working everywhere
// the game itself works (including networks that block Google endpoints).
//
// Trade-off note: two players sending at the exact same moment can race on
// the shared `chat.messages` array (last write wins). For a two-player game
// chat that is an acceptable, rare loss — the sender sees their bubble and
// the conversation continues.

export type ChatPlayerSide = "one" | "two";

export type ChatMessageKind = "text" | "quick" | "sticker";

export type ChatMessage = {
  // Unique id: creation time (base36) + random suffix.
  id: string;
  from: ChatPlayerSide;
  kind: ChatMessageKind;
  text: string;
  // Creation time in milliseconds since epoch (client clock, ordering only).
  t: number;
  // Local-only delivery states (stripped before writing to the room doc).
  pending?: boolean;
  failed?: boolean;
};

export type RoomChatData = {
  messages?: ChatMessage[];
};

/** Hard cap so the shared lobby document stays small. */
export const CHAT_MAX_MESSAGES = 30;

export const CHAT_MAX_TEXT_LENGTH = 140;

/**
 * Persist the chat message list to the room document. Uses the same
 * merge-update contract as every other lobby write (see api/room.js):
 * POST { data: { chat: { messages } } } with the update mask landing on the
 * single leaf path "chat.messages".
 */
export async function writeChatMessages(
  roomCode: string,
  messages: ChatMessage[]
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `/api/room?code=${encodeURIComponent(roomCode)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { chat: { messages: messages.slice(-CHAT_MAX_MESSAGES) } },
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      throw new Error(`Chat write failed with status ${response.status}`);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Strip local-only delivery flags so they never reach the room document. */
export function toWireMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((message) => !message.failed)
    .map((message) => ({
      id: message.id,
      from: message.from,
      kind: message.kind,
      text: message.text,
      t: message.t,
    }))
    .slice(-CHAT_MAX_MESSAGES);
}

export function createChatMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function isPlainChatMessage(value: unknown): value is ChatMessage {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const message = value as Partial<ChatMessage>;
  return (
    (message.from === "one" || message.from === "two") &&
    (message.kind === "text" ||
      message.kind === "quick" ||
      message.kind === "sticker") &&
    typeof message.text === "string" &&
    typeof message.id === "string" &&
    typeof message.t === "number"
  );
}

/** Defensive parse of the chat field coming from the room document. */
export function parseRoomChat(data: unknown): ChatMessage[] {
  const chat = data as RoomChatData | undefined;
  const messages = chat && chat.messages;
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.filter(isPlainChatMessage).slice(-CHAT_MAX_MESSAGES);
}

// ---------------------------------------------------------------------------
// Ready-made content: quick phrases and stickers ("چت و استیکر آماده").
// ---------------------------------------------------------------------------

export const QUICK_PHRASES_EN: string[] = [
  "Good luck!",
  "Nice move!",
  "Your roll!",
  "Hurry up!",
  "Oops!",
  "Wow!",
  "Lucky roll!",
  "Well played!",
  "Good game!",
  "One more game?",
];

export const QUICK_PHRASES_FA: string[] = [
  "سلام!",
  "خوش اومدی!",
  "شروع کنیم؟",
  "چه حرکتی!",
  "شانس آوردی!",
  "حواست کجاست؟",
  "خوب بازی کردی!",
  "یه دست دیگه؟",
  "ممنون!",
  "عالی بود!",
];

export const CHAT_STICKERS: string[] = [
  "👋",
  "👍",
  "👏",
  "🙏",
  "😂",
  "😮",
  "😍",
  "😎",
  "🤔",
  "😅",
  "😢",
  "😭",
  "😡",
  "🥳",
  "😴",
  "🤝",
  "🔥",
  "💀",
  "🍀",
  "🎲",
  "👑",
  "🏆",
];
