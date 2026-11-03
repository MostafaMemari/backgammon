// In-game stickers for online rooms ("استیکر آماده" — like real games' emotes).
//
// No free-text chat: the button opens a ready-made sticker pack, tapping a
// sticker makes it pop big in the middle of BOTH players' boards, exactly
// like the emotes in popular mobile games.
//
// Transport is unchanged and piggybacks on the existing lobby document: the
// panel writes a `chat` field through the same /api/room endpoint the game
// already uses, and the regular lobby poll delivers incoming stickers to the
// opponent. No new endpoints, no Firebase SDK on the client — this keeps
// working everywhere the game itself works (including networks that block
// Google endpoints).

import clapImg from "./assets/stickers/clap.jpg";
import coolImg from "./assets/stickers/cool.jpg";
import crownImg from "./assets/stickers/crown.jpg";
import cryImg from "./assets/stickers/cry.jpg";
import angryImg from "./assets/stickers/angry.jpg";
import laughImg from "./assets/stickers/laugh.jpg";
import partyImg from "./assets/stickers/party.jpg";
import shockedImg from "./assets/stickers/shocked.jpg";
import thinkImg from "./assets/stickers/think.jpg";
import thumbsupImg from "./assets/stickers/thumbsup.jpg";

export type ChatPlayerSide = "one" | "two";

// "text"/"quick" are kept in the wire type so old room documents (from the
// brief text-chat build) still parse; the sticker UI only ever sends stickers.
export type ChatMessageKind = "sticker" | "text" | "quick";

export type ChatMessage = {
  // Unique id: creation time (base36) + random suffix.
  id: string;
  from: ChatPlayerSide;
  kind: ChatMessageKind;
  // For stickers this is the sticker id (see GAME_STICKERS).
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

export type GameSticker = {
  id: string;
  src: string;
  label: string;
};

/** The ready-made sticker pack ("استیکرهای آماده"). */
export const GAME_STICKERS: GameSticker[] = [
  { id: "thumbsup", src: thumbsupImg, label: "Thumbs up" },
  { id: "laugh", src: laughImg, label: "Laughing" },
  { id: "cool", src: coolImg, label: "Cool" },
  { id: "angry", src: angryImg, label: "Angry" },
  { id: "cry", src: cryImg, label: "Crying" },
  { id: "shocked", src: shockedImg, label: "Shocked" },
  { id: "clap", src: clapImg, label: "Clapping" },
  { id: "think", src: thinkImg, label: "Thinking" },
  { id: "party", src: partyImg, label: "Party" },
  { id: "crown", src: crownImg, label: "Winner" },
];

const STICKERS_BY_ID: Record<string, GameSticker> = Object.fromEntries(
  GAME_STICKERS.map((sticker) => [sticker.id, sticker])
);

export function getSticker(id: string): GameSticker | null {
  return STICKERS_BY_ID[id] || null;
}

/** Hard cap so the shared lobby document stays small. */
export const CHAT_MAX_MESSAGES = 12;

/**
 * Persist the sticker history to the room document. Uses the same
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
      throw new Error(`Sticker write failed with status ${response.status}`);
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
    (message.kind === "sticker" ||
      message.kind === "text" ||
      message.kind === "quick") &&
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

/** True when this message is a sticker this client can actually render. */
export function isRenderableSticker(message: ChatMessage): boolean {
  return message.kind === "sticker" && getSticker(message.text) != null;
}
