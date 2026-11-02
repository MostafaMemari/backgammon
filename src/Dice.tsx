import { FunctionComponent, useEffect, useRef, useState } from "react";

import { Color } from "./Types";
import Die from "./Die";
import SubmitMoveButton from "./SubmitMoveButton";
import UndoMoveButton from "./UndoButton";
import { useAppSelector } from "./store/hooks";
import { areBoardStatesEquivalent } from "./store/gameBoardSlice";
import { STARTING_BOARD_STATE } from "./Constants";
import { CSSTransition } from "react-transition-group";
import { playDiceRoll } from "./sound";

type DiceProps = {
  currentPlayerColor: Color;
  diceValues: number[];
  availableDice: number[];
  canSubmit: boolean;
  submitButtonHandler: Function;
};

const Dice: FunctionComponent<DiceProps> = ({
  currentPlayerColor,
  diceValues,
  availableDice,
  canSubmit,
  submitButtonHandler,
}: DiceProps) => {
  let dieOneSpent = false;
  let dieTwoSpent = false;

  const gameBoardState = useAppSelector((state) => state.gameBoard);

  // This state along with the CSSTransition onEntered() hook below triggers the dice
  // rolling animation. We skip the animation if this is the very first time the dice
  // are being shown (i.e. the board state is the starting state) since we already
  // animated the opening rolls in the OpeningDiceRoll component.
  const [hasTriggeredRollAnimation, setHasTriggeredRollAnimation] = useState(
    areBoardStatesEquivalent(gameBoardState, STARTING_BOARD_STATE)
  );

  // Doubles case
  if (diceValues.length === 4) {
    if (availableDice.length === 0) {
      dieOneSpent = true;
      dieTwoSpent = true;
    } else if (availableDice.length >= 1 && availableDice.length <= 2) {
      dieOneSpent = true;
    }
  }
  // Non-doubles case
  else {
    if (!availableDice.includes(diceValues[0])) {
      dieOneSpent = true;
    }
    if (!availableDice.includes(diceValues[1])) {
      dieTwoSpent = true;
    }
  }

  const nodeRef = useRef(null);

  // Play the dice rattle exactly when the tumble animation starts: the
  // moment the reroll class is removed (or on first appearance mid-game when
  // the dice mount already rolling). Covers both local rolls and the opponent's.
  const willReroll = !hasTriggeredRollAnimation;
  const prevForceRerollRef = useRef(willReroll);
  useEffect(() => {
    if (prevForceRerollRef.current && !willReroll) {
      playDiceRoll();
    }
    prevForceRerollRef.current = willReroll;
  }, [willReroll]);

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={true}
      appear={true}
      timeout={0}
      onEntered={() => {
        setTimeout(() => {
          setHasTriggeredRollAnimation(true);
        }, 0);
      }}
    >
      <div className={"Dice"}>
        <UndoMoveButton />
        <Die
          dieValue={diceValues[0]}
          dieSpent={dieOneSpent}
          color={currentPlayerColor}
          forceReroll={!hasTriggeredRollAnimation}
        />
        <Die
          dieValue={diceValues[1]}
          dieSpent={dieTwoSpent}
          color={currentPlayerColor}
          forceReroll={!hasTriggeredRollAnimation}
        />
        <SubmitMoveButton
          canSubmit={canSubmit}
          submitButtonHandler={submitButtonHandler}
        />
      </div>
    </CSSTransition>
  );
};

export default Dice;
