// In-game chat: floating button + panel with ready-made quick phrases,
// stickers and free text. Rendered only inside networked rooms (an opponent
// is required for chat to make sense).
//
// Layout is deliberately compact and responsive: the panel anchors under the
// top-right icon cluster on desktop and becomes a near-full-width sheet on
// phones. All sizes are px/vh based so nothing overlaps at any viewport.

import cx from "classnames";
import { FunctionComponent, useEffect, useRef, useState } from "react";

import {
  CHAT_STICKERS,
  CHAT_MAX_TEXT_LENGTH,
  ChatMessage,
  QUICK_PHRASES_EN,
  QUICK_PHRASES_FA,
} from "./chat";
import { playChatReceive, playSelect } from "./sound";
import {
  chatHideBubble,
  chatRemoveMessage,
  chatSetOpen,
  chatToggleOpen,
  sendChatMessage,
} from "./store/chatSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";

type ChatMode = "text" | "phrases" | "stickers";

const BUBBLE_VISIBLE_MS = 3800;

const ChatPanel: FunctionComponent<{ roomCode: string }> = ({ roomCode }) => {
  const chat = useAppSelector((state) => state.chat);
  const dispatch = useAppDispatch();

  const [mode, setMode] = useState<ChatMode>("text");
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  // Keep the message list pinned to the newest message.
  useEffect(() => {
    const element = messagesRef.current;
    if (element != null) {
      element.scrollTop = element.scrollHeight;
    }
  }, [chat.messages.length, chat.open, mode]);

  // A one-shot receive blip for messages that arrive after the initial sync.
  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const known = knownIdsRef.current;
    if (known == null) {
      knownIdsRef.current = new Set(chat.messages.map((m) => m.id));
      return;
    }
    let received = false;
    for (const message of chat.messages) {
      if (!known.has(message.id)) {
        received = true;
        known.add(message.id);
      }
    }
    if (received) {
      playChatReceive();
    }
  }, [chat.messages]);

  // Auto-hide the board bubble.
  useEffect(() => {
    if (chat.bubble == null) {
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch(chatHideBubble());
    }, BUBBLE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.bubble != null ? chat.bubble.seq : 0]);

  const send = (kind: ChatMessage["kind"], text: string) => {
    dispatch(sendChatMessage(kind, text));
    if (kind === "text") {
      setDraft("");
    }
    playSelect();
  };

  const retryFailed = (message: ChatMessage) => {
    dispatch(chatRemoveMessage(message.id));
    dispatch(sendChatMessage(message.kind, message.text));
  };

  const renderMessage = (message: ChatMessage) => {
    const mine = message.from === chat.mySide;
    return (
      <div
        key={message.id}
        className={cx("Chat-msg-row", mine ? "mine" : "theirs")}
      >
        <div
          className={cx("Chat-msg", message.kind, {
            mine,
            pending: message.pending === true,
            failed: message.failed === true,
          })}
          dir="auto"
          title={message.failed ? "Not delivered — tap to retry" : undefined}
          onClick={
            message.failed ? () => retryFailed(message) : undefined
          }
        >
          {message.kind === "sticker" ? (
            <span className={"Chat-msg-sticker"}>{message.text}</span>
          ) : (
            <span className={"Chat-msg-text"}>{message.text}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={"Chat-button-wrapper"}>
        <div
          className={"Chat-button"}
          title={"Chat with your opponent"}
          onClick={() => {
            dispatch(chatToggleOpen());
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H12l-4.6 3.6c-.5.4-1.2 0-1.2-.6V17H4.5A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4Z"
              fill="currentColor"
              opacity="0.18"
            />
            <path
              d="M4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H12l-4.6 3.6c-.5.4-1.2 0-1.2-.6V17H4.5A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="8.2" cy="10.5" r="1.15" fill="currentColor" />
            <circle cx="12" cy="10.5" r="1.15" fill="currentColor" />
            <circle cx="15.8" cy="10.5" r="1.15" fill="currentColor" />
          </svg>
          {chat.unread > 0 ? (
            <div className={"Chat-unread-badge"}>
              {chat.unread > 9 ? "9+" : chat.unread}
            </div>
          ) : null}
        </div>
      </div>

      {chat.open ? (
        <>
          <div className={"Chat-backdrop"} onClick={() => dispatch(chatSetOpen(false))} />
          <div className={"Chat-panel"}>
            <div className={"Chat-panel-header"}>
              <span className={"Chat-panel-title"}>Chat</span>
              <span className={"Chat-panel-hint"}>{roomCode}</span>
              <div
                className={"Chat-panel-close"}
                onClick={() => dispatch(chatSetOpen(false))}
              >
                ×
              </div>
            </div>
            <div className={"Chat-messages"} ref={messagesRef}>
              {chat.messages.length === 0 ? (
                <div className={"Chat-empty"}>
                  <div className={"Chat-empty-sticker"}>🎲</div>
                  Say hi to your opponent!
                </div>
              ) : (
                chat.messages.map(renderMessage)
              )}
            </div>
            <div className={"Chat-modes"}>
              <div
                className={cx("Chat-mode-btn", { active: mode === "text" })}
                title="Type a message"
                onClick={() => setMode("text")}
              >
                💬
              </div>
              <div
                className={cx("Chat-mode-btn", { active: mode === "phrases" })}
                title="Ready-made phrases"
                onClick={() => setMode("phrases")}
              >
                ⚡
              </div>
              <div
                className={cx("Chat-mode-btn", { active: mode === "stickers" })}
                title="Stickers"
                onClick={() => setMode("stickers")}
              >
                🎭
              </div>
            </div>
            {mode === "text" ? (
              <div className={"Chat-input-row"}>
                <input
                  className={"Chat-input"}
                  type="text"
                  dir="auto"
                  maxLength={CHAT_MAX_TEXT_LENGTH}
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && draft.trim().length > 0) {
                      send("text", draft);
                    }
                  }}
                />
                <div
                  className={cx("Chat-send-btn", {
                    disabled: draft.trim().length === 0,
                  })}
                  onClick={() => {
                    if (draft.trim().length > 0) {
                      send("text", draft);
                    }
                  }}
                >
                  ➤
                </div>
              </div>
            ) : null}
            {mode === "phrases" ? (
              <div className={"Chat-ready-area"}>
                <div className={"Chat-ready-label"}>Quick chat</div>
                <div className={"Chat-phrases-grid"}>
                  {QUICK_PHRASES_EN.map((phrase) => (
                    <div
                      key={`en-${phrase}`}
                      className={"Chat-phrase-chip"}
                      onClick={() => send("quick", phrase)}
                    >
                      {phrase}
                    </div>
                  ))}
                </div>
                <div className={"Chat-ready-label"} dir="rtl">
                  چت سریع
                </div>
                <div className={"Chat-phrases-grid"} dir="rtl">
                  {QUICK_PHRASES_FA.map((phrase) => (
                    <div
                      key={`fa-${phrase}`}
                      className={"Chat-phrase-chip"}
                      dir="auto"
                      onClick={() => send("quick", phrase)}
                    >
                      {phrase}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {mode === "stickers" ? (
              <div className={"Chat-ready-area"}>
                <div className={"Chat-ready-label"}>Stickers</div>
                <div className={"Chat-stickers-grid"}>
                  {CHAT_STICKERS.map((sticker) => (
                    <div
                      key={sticker}
                      className={"Chat-sticker-chip"}
                      onClick={() => send("sticker", sticker)}
                    >
                      {sticker}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {chat.sendError ? (
              <div className={"Chat-error"}>A message failed to send — tap it to retry.</div>
            ) : null}
          </div>
        </>
      ) : null}

      {chat.bubble != null ? (
        <div className={"Chat-bubble"} key={chat.bubble.seq}>
          <div
            className={cx("Chat-bubble-inner", chat.bubble.kind)}
            dir="auto"
          >
            {chat.bubble.kind === "sticker" ? (
              <span className={"Chat-bubble-sticker"}>{chat.bubble.text}</span>
            ) : (
              <span className={"Chat-bubble-text"}>{chat.bubble.text}</span>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ChatPanel;
