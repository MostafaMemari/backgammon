// In-game ready-made stickers ("استیکر آماده"), like the emotes in real
// mobile games. A floating button opens the sticker pack; tapping a sticker
// makes it pop BIG in the middle of both boards for a couple of seconds.
// No free-text chat, no message history — pure game-style emotes.

import cx from "classnames";
import { FunctionComponent, useEffect, useRef } from "react";

import { GAME_STICKERS, GameSticker, getSticker } from "./chat";
import { playChatReceive, playSelect, playStickerPop } from "./sound";
import {
  chatClearSendError,
  chatHidePop,
  chatSetPickerOpen,
  chatTogglePicker,
  sendSticker,
} from "./store/chatSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";

const POP_VISIBLE_MS = 2400;
const SEND_ERROR_VISIBLE_MS = 4000;

const ChatPanel: FunctionComponent<{ roomCode: string }> = () => {
  const chat = useAppSelector((state) => state.chat);
  const dispatch = useAppDispatch();

  // Auto-hide the big board pop.
  useEffect(() => {
    if (chat.pop == null) {
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch(chatHidePop());
    }, POP_VISIBLE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.pop != null ? chat.pop.seq : 0]);

  // Sounds: a soft blip when the opponent's sticker pops, a playful pop when
  // the local one does (played at send time inside send()).
  const lastSeqRef = useRef<number>(-1);
  useEffect(() => {
    if (chat.pop == null) {
      return;
    }
    if (lastSeqRef.current === chat.pop.seq) {
      return;
    }
    lastSeqRef.current = chat.pop.seq;
    if (!chat.pop.mine) {
      playChatReceive();
    }
  }, [chat.pop]);

  // Auto-clear the send-error note.
  useEffect(() => {
    if (!chat.sendError) {
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch(chatClearSendError());
    }, SEND_ERROR_VISIBLE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.sendError]);

  const send = (sticker: GameSticker) => {
    playSelect();
    playStickerPop();
    dispatch(sendSticker(sticker.id));
    // Real games close the emote wheel after a pick — do the same.
    dispatch(chatSetPickerOpen(false));
  };

  const popSticker = chat.pop != null ? getSticker(chat.pop.stickerId) : null;

  return (
    <>
      <div className={"Sticker-button-wrapper"}>
        <div
          className={"Sticker-button"}
          title={"Send a sticker"}
          onClick={() => {
            playSelect();
            dispatch(chatTogglePicker());
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Round sticker badge with a smiley */}
            <circle
              cx="12"
              cy="12"
              r="8.2"
              fill="currentColor"
              opacity="0.16"
            />
            <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9.2" cy="10.2" r="1.05" fill="currentColor" />
            <circle cx="14.8" cy="10.2" r="1.05" fill="currentColor" />
            <path
              d="M8.6 14c.9 1.15 2.05 1.72 3.4 1.72s2.5-.57 3.4-1.72"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {chat.pickerOpen ? (
        <>
          <div
            className={"Sticker-backdrop"}
            onClick={() => dispatch(chatSetPickerOpen(false))}
          />
          <div className={"Sticker-picker"}>
            <div className={"Sticker-picker-header"}>
              <span className={"Sticker-picker-title"}>Stickers</span>
              <div
                className={"Sticker-picker-close"}
                onClick={() => dispatch(chatSetPickerOpen(false))}
              >
                ×
              </div>
            </div>
            <div className={"Sticker-grid"}>
              {GAME_STICKERS.map((sticker) => (
                <div
                  key={sticker.id}
                  className={"Sticker-tile"}
                  title={sticker.label}
                  onClick={() => send(sticker)}
                >
                  <img src={sticker.src} alt={sticker.label} draggable={false} />
                </div>
              ))}
            </div>
            {chat.sendError ? (
              <div className={"Sticker-error"}>
                Sticker failed to send — check the connection and try again.
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {chat.pop != null && popSticker != null ? (
        <div className={"Sticker-pop"} key={chat.pop.seq}>
          <div
            className={cx("Sticker-pop-inner", {
              mine: chat.pop.mine,
            })}
          >
            <img src={popSticker.src} alt={popSticker.label} draggable={false} />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ChatPanel;
