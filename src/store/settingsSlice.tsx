import { createSlice } from "@reduxjs/toolkit";
import { Color, MovementDirection } from "../Types";
import {
  DEFAULT_ANIMATION_INTENSITY,
  DEFAULT_BACKGROUND_THEME,
  DEFAULT_BOARD_THEME,
  DEFAULT_CHECKER_THEME,
  DEFAULT_SHADOW_INTENSITY,
  DEFAULT_SOUND_VOLUME,
} from "../themes";

const VISUAL_PREFS_KEY = "bg-visual-prefs-v1";

type VisualPrefs = {
  boardTheme?: string;
  checkerTheme?: string;
  backgroundTheme?: string;
  shadowIntensity?: number;
  animationIntensity?: number;
  playerOneColor?: Color;
  movementDirection?: MovementDirection;
  soundEnabled?: boolean;
  soundVolume?: number;
};

export function loadVisualPrefs(): VisualPrefs {
  try {
    const raw = localStorage.getItem(VISUAL_PREFS_KEY);
    if (raw != null) {
      return JSON.parse(raw) as VisualPrefs;
    }
  } catch {
    // Corrupted or unavailable storage: fall back to defaults.
  }
  return {};
}

export function saveVisualPrefs(prefs: VisualPrefs): void {
  try {
    localStorage.setItem(VISUAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode etc.) - prefs just won't persist.
  }
}

const prefs = loadVisualPrefs();

export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    movementDirection:
      prefs.movementDirection ?? MovementDirection.CounterClockwise,
    playerOneColor: prefs.playerOneColor ?? Color.White,
    boardTheme: prefs.boardTheme ?? DEFAULT_BOARD_THEME,
    checkerTheme: prefs.checkerTheme ?? DEFAULT_CHECKER_THEME,
    backgroundTheme: prefs.backgroundTheme ?? DEFAULT_BACKGROUND_THEME,
    shadowIntensity: prefs.shadowIntensity ?? DEFAULT_SHADOW_INTENSITY,
    animationIntensity:
      prefs.animationIntensity ?? DEFAULT_ANIMATION_INTENSITY,
    soundEnabled: prefs.soundEnabled ?? true,
    soundVolume: prefs.soundVolume ?? DEFAULT_SOUND_VOLUME,
    showGameOverDialog: false,
    showSettingsMenu: false,
    showMatchSetupScreen: false,
  },
  reducers: {
    setMovementDirection: (
      state,
      action: { type: string; payload: MovementDirection }
    ) => {
      state.movementDirection = action.payload;
      return state;
    },
    setPlayerOneColor: (state, action: { type: string; payload: Color }) => {
      state.playerOneColor = action.payload;
      return state;
    },
    setBoardTheme: (state, action: { type: string; payload: string }) => {
      state.boardTheme = action.payload;
      return state;
    },
    setCheckerTheme: (state, action: { type: string; payload: string }) => {
      state.checkerTheme = action.payload;
      return state;
    },
    setBackgroundTheme: (state, action: { type: string; payload: string }) => {
      state.backgroundTheme = action.payload;
      return state;
    },
    setShadowIntensity: (state, action: { type: string; payload: number }) => {
      state.shadowIntensity = action.payload;
      return state;
    },
    setAnimationIntensity: (
      state,
      action: { type: string; payload: number }
    ) => {
      state.animationIntensity = action.payload;
      return state;
    },
    setSoundEnabled: (state, action: { type: string; payload: boolean }) => {
      state.soundEnabled = action.payload;
      return state;
    },
    setSoundVolume: (state, action: { type: string; payload: number }) => {
      state.soundVolume = action.payload;
      return state;
    },
    setShowGameOverDialog: (
      state,
      action: { type: string; payload: boolean }
    ) => {
      state.showGameOverDialog = action.payload;
      return state;
    },
    setShowSettingsMenu: (
      state,
      action: { type: string; payload: boolean }
    ) => {
      state.showSettingsMenu = action.payload;
      return state;
    },
    setShowMatchSetupScreen: (
      state,
      action: { type: string; payload: boolean }
    ) => {
      state.showMatchSetupScreen = action.payload;
      return state;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setMovementDirection,
  setPlayerOneColor,
  setBoardTheme,
  setCheckerTheme,
  setBackgroundTheme,
  setShadowIntensity,
  setAnimationIntensity,
  setSoundEnabled,
  setSoundVolume,
  setShowGameOverDialog,
  setShowSettingsMenu,
  setShowMatchSetupScreen,
} = settingsSlice.actions;

export default settingsSlice.reducer;
