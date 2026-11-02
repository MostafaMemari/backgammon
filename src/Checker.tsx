import cx from "classnames";
import React, { FunctionComponent } from "react";
import { Animation } from "./Animations";

import { Color } from "./Types";

export enum CheckerStatus {
  Highlighted = "HIGHLIGHTED",
  Selected = "SELECTED",
  None = "NONE",
}

type CheckerProps = {
  animation: Animation | undefined | null;
  checkerPulse: boolean;
  color: Color;
  status: CheckerStatus;
  onAnimationComplete: (id: number) => void;
  /** Small lean in degrees so hand-stacked checkers don't look laser-straight. */
  tilt?: number;
};

const Checker: FunctionComponent<CheckerProps> = ({
  animation,
  checkerPulse,
  color,
  status,
  onAnimationComplete,
  tilt = 0,
}: CheckerProps) => {
  const colorClass = color === Color.White ? "white" : "black";

  const style: React.CSSProperties = {};
  if (tilt !== 0) {
    style.rotate = `${tilt}deg`;
  }
  if (animation != null) {
    // The arc of the move is drawn by the checker-slide keyframes from these
    // start offsets (see App.scss).
    (style as any)["--tx"] = `${animation.translation.translateX}vw`;
    (style as any)["--ty"] = `${animation.translation.translateY}vw`;
  }

  return (
    <div
      className={cx("Checker", colorClass, {
        moving: animation != null,
        // Checkers that were just hit and sent to the bar get a wobble.
        wobble: animation?.isHit === true,
        highlighted:
          status === CheckerStatus.Highlighted && !checkerPulse,
        "highlighted-pulse":
          status === CheckerStatus.Highlighted && checkerPulse,
        "selected-pulse": status === CheckerStatus.Selected,
      })}
      style={style}
      onAnimationEnd={(event) => {
        // Only react to the slide animation finishing on this exact element.
        if (
          animation != null &&
          event.target === event.currentTarget &&
          event.animationName.indexOf("checker-slide") === 0
        ) {
          onAnimationComplete(animation.id);
        }
      }}
    />
  );
};

export default Checker;
