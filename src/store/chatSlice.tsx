// Redux state for the in-game sticker system.
//
// The slice mirrors the room document's `chat.messages` field into local
// state purely as a transport history — the UI shows no message list. When a
// sticker arrives (from the opponent over the poll, or optimistically from a
// local tap) it becomes a big animated "pop" over the board, like the emotes
// in real mobile games. Sends are optimistic: the pop shows instantly and the
// write to /api/room confirms (or visibly fails) in the background.

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  ChatMessage,
  ChatPlayerSide,
  CHAT_MAX_MESSAGES,
  createChatMessageId,
  getSticker,
  isRenderableSticker,
  toWireMessages,
  writeChatMessages,
} from "../chat";
import { AppDispatch, RootState } from "./store";

export type StickerPop = {
  stickerId: string;
  // True when the local player sent it (shows instantly, no sound).
  mine: boolean;
  // Increments per pop so the same sticker re-triggers the animation.
  seq: number;
};

type ChatState = {
  connected: boolean;
  roomCode: string | null;
  mySide: ChatPlayerSide | null;
  // Transport history only — kept so writes merge instead of wiping history.
  messages: ChatMessage[];
  pickerOpen: boolean;
  pop: StickerPop | null;
  sendError: boolean;
};

const InitialChatState: ChatState = {
  connected: false,
  roomCode: null,
  mySide: null,
  messages: [],
  pickerOpen: false,
  pop: null,
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
    // no pop for old stickers.
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
      state.pickerOpen = false;
      state.pop = null;
      state.sendError = false;
    },
    // Subsequent syncs: merge in whatever is new and pop the latest opponent
    // sticker big over the board.
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
        // behave like a seed so old history never pops.
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
      state.messages = mergeIncoming(state.messages, incoming);

      const newFromOpponent = incoming.filter(
        (message) =>
          message.from !== state.mySide &&
          !prevIds.has(message.id) &&
          isRenderableSticker(message)
      );
      const last = newFromOpponent[newFromOpponent.length - 1];
      if (last != null) {
        state.pop = {
          stickerId: getSticker(last.text)!.id,
          mine: false,
          seq: (state.pop != null ? state.pop.seq : 0) + 1,
        };
      }
    },
    chatDisconnected() {
      return InitialChatState;
    },
    chatSetPickerOpen(state, action: PayloadAction<boolean>) {
      state.pickerOpen = action.payload;
      if (action.payload) {
        state.sendError = false;
      }
    },
    chatTogglePicker(state) {
      state.pickerOpen = !state.pickerOpen;
      if (state.pickerOpen) {
        state.sendError = false;
      }
    },
    chatHidePop(state) {
      state.pop = null;
    },
    chatClearSendError(state) {
      state.sendError = false;
    },
    chatMessagePending(
      state,
      action: PayloadAction<{ message: ChatMessage; pop: StickerPop }>
    ) {
      state.messages = [...state.messages, action.payload.message].slice(
        -CHAT_MAX_MESSAGES
      );
      state.pop = action.payload.pop;
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
  },
});

export const {
  chatSeed,
  chatIncoming,
  chatDisconnected,
  chatSetPickerOpen,
  chatTogglePicker,
  chatHidePop,
  chatClearSendError,
  chatMessagePending,
  chatMessageDelivered,
  chatMessageFailed,
} = chatSlice.actions;

/**
 * Send a ready-made sticker: pop it over the local board instantly, then
 * persist the merged history to the room document so the opponent's poll
 * delivers the same pop. If the write fails, a small error note appears in
 * the picker and the sticker is dropped from the wire history.
 */
export function sendSticker(stickerId: string) {
  return async (
    dispatch: AppDispatch,
    getState: () => RootState
  ): Promise<void> => {
    const chat = getState().chat;
    if (!chat.connected || chat.mySide == null || chat.roomCode == null) {
      return;
    }
    if (getSticker(stickerId) == null) {
      return;
    }

    const message: ChatMessage = {
      id: createChatMessageId(),
      from: chat.mySide,
      kind: "sticker",
      text: stickerId,
      t: Date.now(),
      pending: true,
    };
    const pop: StickerPop = {
      stickerId,
      mine: true,
      seq: (chat.pop != null ? chat.pop.seq : 0) + 1,
    };
    dispatch(chatMessagePending({ message, pop }));

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
