import { createSlice } from "@reduxjs/toolkit";
import { Color, MovementDirection } from "../Types";
import {
  DEFAULT_BACKGROUND_THEME,
  DEFAULT_BOARD_THEME,
  DEFAULT_CHECKER_THEME,
  DEFAULT_SOUND_VOLUME,
  GRAPHICS_PRESETS,
  detectPerformanceMode,
  GraphicsQuality,
  PerformanceMode,
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
  performanceMode?: PerformanceMode;
  graphicsQuality?: GraphicsQuality;
  optShadows?: boolean;
  optAmbient?: boolean;
  optGlow?: boolean;
  optGrain?: boolean;
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

/** The individual graphics switches, like the advanced menu of PC games. */
export type GraphicsOptions = {
  /** Static drop-shadows under checkers, triangles, titles... */
  shadows: boolean;
  /** Slowly floating ambient circles behind the board. */
  ambient: boolean;
  /** Pulsing glows on movable/selected checkers, points and roll button. */
  glow: boolean;
  /** Procedural wood / felt texture layers on the board. */
  grain: boolean;
};

/** The switch combination each quality preset represents. */
export function graphicsOptionsForMode(mode: PerformanceMode): GraphicsOptions {
  switch (mode) {
    case "low":
      return { shadows: false, ambient: false, glow: false, grain: false };
    case "medium":
      return { shadows: true, ambient: true, glow: false, grain: true };
    default:
      return { shadows: true, ambient: true, glow: true, grain: true };
  }
}

const prefs = loadVisualPrefs();

// Effective quality for this device: the saved preset if the user ever chose
// one, otherwise the hardware-based guess. Fresh visitors start with the
// preset's slider values and switch combination, so the selected card, the
// sliders and the advanced switches always tell the same story.
const initialMode = prefs.performanceMode ?? detectPerformanceMode();
const initialPreset =
  GRAPHICS_PRESETS.find((p) => p.id === initialMode) ?? GRAPHICS_PRESETS[1];
const initialOpts = graphicsOptionsForMode(initialMode);

export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    movementDirection:
      prefs.movementDirection ?? MovementDirection.CounterClockwise,
    playerOneColor: prefs.playerOneColor ?? Color.White,
    boardTheme: prefs.boardTheme ?? DEFAULT_BOARD_THEME,
    checkerTheme: prefs.checkerTheme ?? DEFAULT_CHECKER_THEME,
    backgroundTheme: prefs.backgroundTheme ?? DEFAULT_BACKGROUND_THEME,
    shadowIntensity: prefs.shadowIntensity ?? initialPreset.shadowIntensity,
    animationIntensity:
      prefs.animationIntensity ?? initialPreset.animationIntensity,
    soundEnabled: prefs.soundEnabled ?? true,
    soundVolume: prefs.soundVolume ?? DEFAULT_SOUND_VOLUME,
    // Auto-tuned once per device on first visit (weak laptops start in
    // Medium or Low), then always whatever the user picked.
    performanceMode: initialMode,
    // Which graphics quality preset is active ("custom" after fine-tuning).
    graphicsQuality: prefs.graphicsQuality ?? initialMode,
    // Individual advanced switches; they start at whatever the initial
    // preset implies and can then be overridden one by one.
    optShadows: prefs.optShadows ?? initialOpts.shadows,
    optAmbient: prefs.optAmbient ?? initialOpts.ambient,
    optGlow: prefs.optGlow ?? initialOpts.glow,
    optGrain: prefs.optGrain ?? initialOpts.grain,
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
      state.graphicsQuality = "custom";
      return state;
    },
    setAnimationIntensity: (
      state,
      action: { type: string; payload: number }
    ) => {
      state.animationIntensity = action.payload;
      state.graphicsQuality = "custom";
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
    setPerformanceMode: (
      state,
      action: { type: string; payload: PerformanceMode }
    ) => {
      state.performanceMode = action.payload;
      state.graphicsQuality = action.payload;
      // Like a graphics preset in PC games: picking a quality level snaps
      // every advanced switch to that level. Individual switches can then
      // be fine-tuned afterwards.
      const o = graphicsOptionsForMode(action.payload);
      state.optShadows = o.shadows;
      state.optAmbient = o.ambient;
      state.optGlow = o.glow;
      state.optGrain = o.grain;
      return state;
    },
    // One-click graphics preset (like a game's graphics menu): sets the
    // rendering tier, the advanced switches and both effect sliders
    // together.
    applyGraphicsPreset: (
      state,
      action: { type: string; payload: Exclude<GraphicsQuality, "custom"> }
    ) => {
      const p =
        action.payload === "low"
          ? { mode: "low" as const, shadow: 10, anim: 10 }
          : action.payload === "high"
          ? { mode: "high" as const, shadow: 85, anim: 100 }
          : { mode: "medium" as const, shadow: 60, anim: 70 };
      const o = graphicsOptionsForMode(p.mode);
      state.graphicsQuality = action.payload;
      state.performanceMode = p.mode;
      state.shadowIntensity = p.shadow;
      state.animationIntensity = p.anim;
      state.optShadows = o.shadows;
      state.optAmbient = o.ambient;
      state.optGlow = o.glow;
      state.optGrain = o.grain;
      return state;
    },
    // Fine-tuning any advanced switch turns the preset selection into
    // "custom", exactly like moving a slider does.
    setOptShadows: (state, action: { type: string; payload: boolean }) => {
      state.optShadows = action.payload;
      state.graphicsQuality = "custom";
      return state;
    },
    setOptAmbient: (state, action: { type: string; payload: boolean }) => {
      state.optAmbient = action.payload;
      state.graphicsQuality = "custom";
      return state;
    },
    setOptGlow: (state, action: { type: string; payload: boolean }) => {
      state.optGlow = action.payload;
      state.graphicsQuality = "custom";
      return state;
    },
    setOptGrain: (state, action: { type: string; payload: boolean }) => {
      state.optGrain = action.payload;
      state.graphicsQuality = "custom";
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
  setPerformanceMode,
  applyGraphicsPreset,
  setOptShadows,
  setOptAmbient,
  setOptGlow,
  setOptGrain,
  setShowGameOverDialog,
  setShowSettingsMenu,
  setShowMatchSetupScreen,
} = settingsSlice.actions;

export default settingsSlice.reducer;
