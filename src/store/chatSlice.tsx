// Redux state for the in-game chat panel.
//
// The slice mirrors the room document's `chat.messages` field into local
// state, tracks unread messages from the opponent and a small "board bubble"
// that flashes the latest opponent message over the game. Optimistic sends
// appear instantly and are confirmed (or dropped with a visible failure
// state) once the write to /api/room resolves.

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  ChatMessage,
  ChatMessageKind,
  ChatPlayerSide,
  CHAT_MAX_MESSAGES,
  createChatMessageId,
  toWireMessages,
  writeChatMessages,
} from "../chat";
import { AppDispatch, RootState } from "./store";

type ChatBubble = {
  text: string;
  kind: ChatMessageKind;
  // Increments per bubble so the same sticker re-triggers the animation.
  seq: number;
};

type ChatState = {
  connected: boolean;
  roomCode: string | null;
  mySide: ChatPlayerSide | null;
  messages: ChatMessage[];
  open: boolean;
  unread: number;
  bubble: ChatBubble | null;
  sendError: boolean;
};

const InitialChatState: ChatState = {
  connected: false,
  roomCode: null,
  mySide: null,
  messages: [],
  open: false,
  unread: 0,
  bubble: null,
  sendError: false,
};

function mergeIncoming(
  localMessages: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of incoming) {
    byId.set(message.id, { ...message, pending: false, failed: false });
  }
  // Keep optimistic local sends that the room doc does not reflect yet.
  for (const message of localMessages) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))
    .slice(-CHAT_MAX_MESSAGES);
}

const chatSlice = createSlice({
  name: "chat",
  initialState: InitialChatState,
  reducers: {
    // First sync after connecting (or reconnecting): load history silently —
    // no unread counter, no bubble for old messages.
    chatSeed(
      state,
      action: PayloadAction<{
        messages: ChatMessage[];
        mySide: ChatPlayerSide;
        roomCode: string;
      }>
    ) {
      state.connected = true;
      state.mySide = action.payload.mySide;
      state.roomCode = action.payload.roomCode;
      state.messages = mergeIncoming(state.messages, action.payload.messages);
      state.unread = 0;
      state.bubble = null;
    },
    // Subsequent syncs: merge in whatever is new and count opponent messages
    // that arrived while the panel was closed.
    chatIncoming(
      state,
      action: PayloadAction<{
        messages: ChatMessage[];
        roomCode: string;
        mySide: ChatPlayerSide;
      }>
    ) {
      if (!state.connected) {
        // Seed was missed (e.g. the first poll carried no chat field);
        // behave like a seed so old history never counts as unread.
        state.connected = true;
        state.mySide = action.payload.mySide;
        state.roomCode = action.payload.roomCode;
        state.messages = mergeIncoming(
          state.messages,
          action.payload.messages
        );
        return;
      }
      state.mySide = action.payload.mySide;
      state.roomCode = action.payload.roomCode;

      const prevIds = new Set(state.messages.map((message) => message.id));
      const incoming = action.payload.messages;
      const newFromOpponent = incoming.filter(
        (message) =>
          message.from !== state.mySide && !prevIds.has(message.id)
      );

      state.messages = mergeIncoming(state.messages, incoming);

      if (!state.open) {
        state.unread += newFromOpponent.length;
        const last = newFromOpponent[newFromOpponent.length - 1];
        if (last != null) {
          state.bubble = {
            text: last.text,
            kind: last.kind,
            seq: (state.bubble != null ? state.bubble.seq : 0) + 1,
          };
        }
      }
    },
    chatDisconnected() {
      return InitialChatState;
    },
    chatSetOpen(state, action: PayloadAction<boolean>) {
      state.open = action.payload;
      if (action.payload) {
        state.unread = 0;
        state.bubble = null;
        state.sendError = false;
      }
    },
    chatToggleOpen(state) {
      state.open = !state.open;
      if (state.open) {
        state.unread = 0;
        state.bubble = null;
        state.sendError = false;
      }
    },
    chatHideBubble(state) {
      state.bubble = null;
    },
    chatMessagePending(state, action: PayloadAction<ChatMessage>) {
      state.messages = [...state.messages, action.payload].slice(
        -CHAT_MAX_MESSAGES
      );
      state.sendError = false;
    },
    chatMessageDelivered(state, action: PayloadAction<string>) {
      const message = state.messages.find((m) => m.id === action.payload);
      if (message != null) {
        message.pending = false;
        message.failed = false;
      }
    },
    chatMessageFailed(state, action: PayloadAction<string>) {
      const message = state.messages.find((m) => m.id === action.payload);
      if (message != null) {
        message.pending = false;
        message.failed = true;
      }
      state.sendError = true;
    },
    chatRemoveMessage(state, action: PayloadAction<string>) {
      state.messages = state.messages.filter((m) => m.id !== action.payload);
      state.sendError = false;
    },
  },
});

export const {
  chatSeed,
  chatIncoming,
  chatDisconnected,
  chatSetOpen,
  chatToggleOpen,
  chatHideBubble,
  chatMessagePending,
  chatMessageDelivered,
  chatMessageFailed,
  chatRemoveMessage,
} = chatSlice.actions;

/**
 * Append a message optimistically, then persist the merged list to the room
 * document. The message shows instantly for the sender; if the write fails
 * it is marked with a visible failure state and can be retried with a tap.
 */
export function sendChatMessage(kind: ChatMessageKind, rawText: string) {
  return async (
    dispatch: AppDispatch,
    getState: () => RootState
  ): Promise<void> => {
    const chat = getState().chat;
    if (!chat.connected || chat.mySide == null || chat.roomCode == null) {
      return;
    }
    const text =
      kind === "sticker"
        ? rawText.trim().slice(0, 8)
        : rawText.trim().slice(0, 140);
    if (text.length === 0) {
      return;
    }

    const message: ChatMessage = {
      id: createChatMessageId(),
      from: chat.mySide,
      kind,
      text,
      t: Date.now(),
      pending: true,
    };
    dispatch(chatMessagePending(message));

    try {
      const wire = toWireMessages(getState().chat.messages);
      if (wire.length === 0) {
        return;
      }
      await writeChatMessages(chat.roomCode, wire);
    } catch (error) {
      dispatch(chatMessageFailed(message.id));
      return;
    }
    dispatch(chatMessageDelivered(message.id));
  };
}

export default chatSlice.reducer;
