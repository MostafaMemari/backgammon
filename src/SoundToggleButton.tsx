import cx from "classnames";
import { FunctionComponent } from "react";

import { useAppDispatch, useAppSelector } from "./store/hooks";
import { setSoundEnabled } from "./store/settingsSlice";

type SoundToggleButtonProps = {};

/** Small speaker button next to the settings gear for one-tap mute. */
const SoundToggleButton: FunctionComponent<SoundToggleButtonProps> = () => {
  const [soundEnabled, soundVolume] = useAppSelector((state) => [
    state.settings.soundEnabled,
    state.settings.soundVolume,
  ]);
  const dispatch = useAppDispatch();

  const muted = !soundEnabled || soundVolume === 0;

  return (
    <div className={"Sound-toggle-button-wrapper"}>
      <div
        className={cx("Sound-toggle-button", { muted })}
        title={muted ? "Sound off" : "Sound on"}
        onClick={() => dispatch(setSoundEnabled(muted))}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4 9.5v5h3.4L12 18.6V5.4L7.4 9.5H4z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          {muted ? (
            <path
              d="M15.5 9.5l5 5m0-5l-5 5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path
                d="M15.2 9.2a4 4 0 010 5.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M17.6 7a7.2 7.2 0 010 10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                opacity="0.75"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default SoundToggleButton;
