import { configureStore } from "@reduxjs/toolkit";

import currentPlayerReducer from "./currentPlayerSlice";
import diceReducer from "./diceSlice";
import gameBoardReducer from "./gameBoardSlice";
import gameStateReducer from "./gameStateSlice";
import lastPointClickedReducer from "./lastPointClickedSlice";
import provisionalMovesReducer from "./provisionalMovesSlice";
import settingsReducer from "./settingsSlice";
import playersSliceReducer from "./playersSlice";
import animatableMovesReducer from "./animatableMovesSlice";
import doublingCubeReducer from "./doublingCubeSlice";
import matchScoreReducer from "./matchScoreSlice";
import wipeTransitionReducer from "./wipeTransitionSlice";
import readyForNextGameReducer from "./readyForNextGameSlice";
import { saveVisualPrefs } from "./settingsSlice";

export const store = configureStore({
  reducer: {
    gameBoard: gameBoardReducer,
    gameState: gameStateReducer,
    lastPointClicked: lastPointClickedReducer,
    provisionalMoves: provisionalMovesReducer,
    dice: diceReducer,
    currentPlayer: currentPlayerReducer,
    players: playersSliceReducer,
    settings: settingsReducer,
    animatableMoves: animatableMovesReducer,
    doublingCube: doublingCubeReducer,
    matchScore: matchScoreReducer,
    wipeTransition: wipeTransitionReducer,
    readyForNextGame: readyForNextGameReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Persist the user's device-local visual preferences (themes + effect
// sliders + sound + personal color/direction) whenever they change.
store.subscribe(() => {
  const s = store.getState().settings;
  saveVisualPrefs({
    boardTheme: s.boardTheme,
    checkerTheme: s.checkerTheme,
    backgroundTheme: s.backgroundTheme,
    shadowIntensity: s.shadowIntensity,
    animationIntensity: s.animationIntensity,
    soundEnabled: s.soundEnabled,
    soundVolume: s.soundVolume,
    playerOneColor: s.playerOneColor,
    movementDirection: s.movementDirection,
    performanceMode: s.performanceMode,
    optShadows: s.optShadows,
    optAmbient: s.optAmbient,
    optGlow: s.optGlow,
    optGrain: s.optGrain,
  });
});
