/**
 * Visual theme system.
 *
 * Three independent, user-selectable theme axes (all device-local, they are
 * never synced over the network):
 *
 *   - Board themes:  wood frame + playing field + point triangle colors.
 *   - Checker sets:  how the "light" and "dark" checkers are rendered.
 *   - Backgrounds:   the ambient backdrop behind the board.
 *
 * Plus two "effects" sliders (shadow depth / animation intensity) which are
 * also applied as CSS custom properties.
 *
 * Everything is applied by writing CSS variables on document.documentElement,
 * and App.scss consumes those variables.
 */

import { Color } from "./Types";

export type RGB = string;

export type BoardThemeDef = {
  id: string;
  name: string;
  /** Wood frame gradient (border around each board half). */
  frameLight: RGB;
  frameDark: RGB;
  /** Playing field base gradient (behind the triangles). */
  fieldLight: RGB;
  fieldDark: RGB;
  /** Point triangles: alternating inner face colors. */
  pointA: RGB;
  pointB: RGB;
  /** Slightly darker outer edge color used by the triangle shadow layer. */
  pointAEdge: RGB;
  pointBEdge: RGB;
  /** The center bar (leather/felt strip) gradient. */
  barLight: RGB;
  barDark: RGB;
  /** Home board tray gradient. */
  homeLight: RGB;
  homeDark: RGB;
  /** Metal hinge clasps on the bar. */
  hingeLight: RGB;
  hingeDark: RGB;
  /** Destination-move glow color. */
  highlight: RGB;
  /** Field vignette strength 0..1. */
  vignette: number;
};

export type CheckerStyleDef = {
  light: RGB;
  mid: RGB;
  dark: RGB;
  edge: RGB;
  ring: RGB;
};

export type CheckerThemeDef = {
  id: string;
  name: string;
  /** Appearance of the "white" player's checkers. */
  a: CheckerStyleDef;
  /** Appearance of the "black" player's checkers. */
  b: CheckerStyleDef;
};

export type BackgroundThemeDef = {
  id: string;
  name: string;
  /** Full background CSS gradient value. */
  bg: string;
  /** Color of the floating ambient circles. */
  circle: RGB;
};

/*******************
 * SVG generation   *
 *******************/

function svgUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Renders a realistic backgammon checker: beveled rim, concentric groove
 * rings, dome lighting and a soft top-left gloss.
 */
function checkerSVG(
  c: CheckerStyleDef,
  selected: boolean,
  movable = false
): string {
  const ring = (r: number, w: number, o: number) =>
    `<circle cx="64" cy="64" r="${r}" fill="none" stroke="${c.ring}" stroke-opacity="${o}" stroke-width="${w}"/>`;
  const rings = [
    ring(47, 3, 0.5),
    ring(41, 1.6, 0.32),
    ring(35.5, 2.6, 0.42),
    ring(30, 1.2, 0.26),
    ring(24.5, 2.2, 0.38),
    ring(20.5, 1, 0.22),
  ].join("");
  const selRing = selected
    ? `<circle cx="64" cy="64" r="55" fill="none" stroke="#FFDF8F" stroke-opacity="0.95" stroke-width="5.5"/>
       <circle cx="64" cy="64" r="49.5" fill="none" stroke="#FFF3C4" stroke-opacity="0.5" stroke-width="2"/>`
    : "";
  // Green "you can move this" ring so movable checkers are unmistakable even
  // where glow filters render weakly (cheap mobile GPUs, bright boards).
  const moveRing = movable
    ? `<circle cx="64" cy="64" r="60" fill="none" stroke="#0E7A38" stroke-opacity="0.85" stroke-width="3.5"/>
       <circle cx="64" cy="64" r="55.5" fill="none" stroke="#33E86F" stroke-opacity="1" stroke-width="5.5"/>
       <circle cx="64" cy="64" r="49.5" fill="none" stroke="#E9FFF1" stroke-opacity="0.6" stroke-width="2"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<linearGradient id="rim" x1="20" y1="12" x2="100" y2="122" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${c.mid}"/>
<stop offset="0.55" stop-color="${c.dark}"/>
<stop offset="1" stop-color="${c.edge}"/>
</linearGradient>
<radialGradient id="face" cx="0.38" cy="0.3" r="0.9">
<stop offset="0" stop-color="${c.light}"/>
<stop offset="0.55" stop-color="${c.mid}"/>
<stop offset="1" stop-color="${c.dark}"/>
</radialGradient>
<radialGradient id="gloss" cx="0.32" cy="0.22" r="0.5">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.5"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</radialGradient>
<radialGradient id="shade" cx="0.6" cy="0.85" r="0.8">
<stop offset="0" stop-color="#000000" stop-opacity="0.18"/>
<stop offset="1" stop-color="#000000" stop-opacity="0"/>
</radialGradient>
</defs>
<circle cx="64" cy="64" r="63" fill="url(#rim)"/>
<circle cx="64" cy="64" r="56" fill="url(#face)"/>
${rings}
<circle cx="64" cy="64" r="56" fill="url(#shade)"/>
<circle cx="64" cy="64" r="56" fill="url(#gloss)"/>
${selRing}
${moveRing}
</svg>`;
}

/**
 * Side-view "slab" of a checker as it appears stacked in the home tray.
 */
function checkerHomeSVG(c: CheckerStyleDef): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 44">
<defs>
<linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${c.light}"/>
<stop offset="0.6" stop-color="${c.mid}"/>
<stop offset="1" stop-color="${c.dark}"/>
</linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.4"/>
<stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
</linearGradient>
</defs>
<rect x="2" y="3" width="124" height="38" rx="7" fill="${c.edge}"/>
<rect x="3" y="2" width="122" height="37" rx="7" fill="url(#top)"/>
<rect x="3" y="2" width="122" height="37" rx="7" fill="url(#sheen)"/>
<line x1="14" y1="21" x2="114" y2="21" stroke="${c.ring}" stroke-opacity="0.4" stroke-width="1.6"/>
<line x1="14" y1="26" x2="114" y2="26" stroke="${c.ring}" stroke-opacity="0.28" stroke-width="1"/>
</svg>`;
}

/**
 * Neutral wood-grain noise tile (grayscale turbulence). It is layered over
 * the theme's wood gradients with a soft-light blend in CSS so a single
 * asset naturally adapts to every board theme.
 */
const WOOD_GRAIN_URI = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
<filter id="w">
<feTurbulence type="fractalNoise" baseFrequency="0.012 0.22" numOctaves="4" seed="11"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.6 0.6 0.6 0 0"/>
</filter>
<rect width="420" height="420" filter="url(#w)"/>
</svg>`
);

/** Fine fabric/felt noise used on the playing field. */
const FIELD_GRAIN_URI = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
<filter id="f">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.5 0.5 0.5 0 0"/>
</filter>
<rect width="300" height="300" filter="url(#f)"/>
</svg>`
);

/***************************
 * Theme definitions        *
 ***************************/

export const BOARD_THEMES: BoardThemeDef[] = [
  {
    id: "walnut",
    name: "Walnut Classic",
    frameLight: "#7A5222",
    frameDark: "#33200C",
    fieldLight: "#EBD9AC",
    fieldDark: "#D9C08C",
    pointA: "#F2DCA8",
    pointB: "#AE4A31",
    pointAEdge: "#C2A06A",
    pointBEdge: "#7C3020",
    barLight: "#2E4E7E",
    barDark: "#16283F",
    homeLight: "#2E4E7E",
    homeDark: "#16283F",
    hingeLight: "#F0D092",
    hingeDark: "#8A6435",
    highlight: "#FFDF8F",
    vignette: 0.24,
  },
  {
    id: "emerald",
    name: "Emerald Felt",
    frameLight: "#6E3B22",
    frameDark: "#2E180A",
    fieldLight: "#2F7D52",
    fieldDark: "#1C5436",
    pointA: "#F5EFD8",
    pointB: "#C05548",
    pointAEdge: "#C9BE9C",
    pointBEdge: "#82362C",
    barLight: "#123B2A",
    barDark: "#0A241A",
    homeLight: "#123B2A",
    homeDark: "#0A241A",
    hingeLight: "#E8E8F0",
    hingeDark: "#7E8494",
    highlight: "#FFDF8F",
    vignette: 0.28,
  },
  {
    id: "royal",
    name: "Royal Blue",
    frameLight: "#2C3E5E",
    frameDark: "#121C30",
    fieldLight: "#F0E3C0",
    fieldDark: "#DEC99A",
    pointA: "#E8C877",
    pointB: "#35558C",
    pointAEdge: "#B9973F",
    pointBEdge: "#223C68",
    barLight: "#1F2E4A",
    barDark: "#101A2E",
    homeLight: "#1F2E4A",
    homeDark: "#101A2E",
    hingeLight: "#EEF0F6",
    hingeDark: "#828CA4",
    highlight: "#FFD980",
    vignette: 0.24,
  },
  {
    id: "crimson",
    name: "Crimson Velvet",
    frameLight: "#4A2E1E",
    frameDark: "#1F120A",
    fieldLight: "#7E2E33",
    fieldDark: "#521B20",
    pointA: "#F2E4C4",
    pointB: "#33302C",
    pointAEdge: "#C7B48D",
    pointBEdge: "#1C1A17",
    barLight: "#3A1A1E",
    barDark: "#20090C",
    homeLight: "#3A1A1E",
    homeDark: "#20090C",
    hingeLight: "#F0D092",
    hingeDark: "#8A6435",
    highlight: "#FFC46A",
    vignette: 0.3,
  },
  {
    id: "sand",
    name: "Desert Sand",
    frameLight: "#A87840",
    frameDark: "#54371A",
    fieldLight: "#EAD8AC",
    fieldDark: "#D6BD8A",
    pointA: "#C07848",
    pointB: "#7A5A30",
    pointAEdge: "#96562C",
    pointBEdge: "#584022",
    barLight: "#7A5228",
    barDark: "#3E2A10",
    homeLight: "#7A5228",
    homeDark: "#3E2A10",
    hingeLight: "#E0A070",
    hingeDark: "#8A5028",
    highlight: "#FFE2A0",
    vignette: 0.2,
  },
];

export const CHECKER_THEMES: CheckerThemeDef[] = [
  {
    id: "ivory-ebony",
    name: "Ivory & Ebony",
    a: { light: "#FFFEF6", mid: "#F4E6C2", dark: "#D8C091", edge: "#A88C55", ring: "#B49B66" },
    b: { light: "#6A5340", mid: "#4A382A", dark: "#2C2118", edge: "#191008", ring: "#8A705A" },
  },
  {
    id: "white-cherry",
    name: "White & Cherry",
    a: { light: "#FFFFFF", mid: "#F2EFE6", dark: "#D8D2C2", edge: "#A9A290", ring: "#BCB4A0" },
    b: { light: "#E06A5E", mid: "#C2453B", dark: "#8E2A22", edge: "#5C1712", ring: "#F0A99F" },
  },
  {
    id: "gold-onyx",
    name: "Gold & Onyx",
    a: { light: "#F9E4A0", mid: "#DDB45C", dark: "#B4883A", edge: "#8A6526", ring: "#FFF0C0" },
    b: { light: "#4A4A54", mid: "#2E2E36", dark: "#1A1A20", edge: "#0A0A0E", ring: "#9A9AB0" },
  },
  {
    id: "jade-obsidian",
    name: "Jade & Obsidian",
    a: { light: "#9FE2C4", mid: "#5CBA94", dark: "#338765", edge: "#1E5C46", ring: "#CFF2E2" },
    b: { light: "#5A5E6A", mid: "#383B44", dark: "#22242C", edge: "#101216", ring: "#8C93A6" },
  },
  {
    id: "silver-midnight",
    name: "Silver & Midnight",
    a: { light: "#F6F8FB", mid: "#D9DEE8", dark: "#B2B8C6", edge: "#868DA0", ring: "#C4CAD8" },
    b: { light: "#3E5C92", mid: "#28416C", dark: "#17294A", edge: "#0C1526", ring: "#7C9CD0" },
  },
];

export const BACKGROUND_THEMES: BackgroundThemeDef[] = [
  {
    id: "velvet-night",
    name: "Velvet Night",
    bg: "linear-gradient(to bottom, #262D4D, #10121F)",
    circle: "#83919E",
  },
  {
    id: "casino",
    name: "Casino Green",
    bg: "linear-gradient(to bottom, #1E4436, #0B1E15)",
    circle: "#7FAE9A",
  },
  {
    id: "charcoal",
    name: "Charcoal Slate",
    bg: "linear-gradient(to bottom, #3A3F46, #15171B)",
    circle: "#9AA2AD",
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    bg: "linear-gradient(to bottom, #3A2C55, #150E24)",
    circle: "#A08CC0",
  },
  {
    id: "bordeaux",
    name: "Bordeaux",
    bg: "linear-gradient(to bottom, #55232B, #1E090D)",
    circle: "#C08A92",
  },
];

/**
 * Move-affordance green. Deliberately independent of the board theme so
 * players learn one consistent rule: green ring = movable checker,
 * green triangle = place you can move to.
 */
export const MOVE_HIGHLIGHT = {
  color: "#33E86F",
  rgb: "51, 232, 111",
};

export const DEFAULT_BOARD_THEME = "walnut";
export const DEFAULT_CHECKER_THEME = "ivory-ebony";
export const DEFAULT_BACKGROUND_THEME = "velvet-night";
export const DEFAULT_SHADOW_INTENSITY = 60;
export const DEFAULT_ANIMATION_INTENSITY = 70;
export const DEFAULT_SOUND_VOLUME = 70;

/****************************
 * Performance / quality     *
 ****************************/

/**
 * How much rendering power the game is allowed to use:
 *
 *  - "high"    Full experience: every glow pulse, ambient circles, all
 *              filters and transitions.
 *  - "medium"  Identical static look, but nothing repaints every frame:
 *              infinite glow pulses become static glows, ambient circles
 *              are reduced, no perpetual board re-renders.
 *  - "low"     For weak laptops/browsers: no drop-shadow filters at all,
 *              no ambient circles, no layered effects. Highlights stay
 *              perfectly visible because the green/gold rings are baked
 *              into the checker images.
 */
export type PerformanceMode = "high" | "medium" | "low";

export const PERFORMANCE_MODES: { id: PerformanceMode; name: string }[] = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
];

/**
 * Game-style graphics quality presets (like the graphics menu in PC games).
 *
 * A preset is a one-click bundle that sets the rendering tier AND the two
 * effect sliders at once, so a player on a very weak laptop can just pick
 * "Low" and get the simplest possible look without touching anything else.
 * Picking a preset, then moving any individual slider, switches the
 * selection to "custom" (fine-tuning is always allowed).
 */
export type GraphicsQuality = PerformanceMode | "custom";

export type GraphicsPresetDef = {
  id: Exclude<GraphicsQuality, "custom">;
  name: string;
  /** Short promise shown under the name ("Best speed", ...). */
  tagline: string;
  /** One-line description of what this tier does. */
  description: string;
  performanceMode: PerformanceMode;
  shadowIntensity: number;
  animationIntensity: number;
};

export const GRAPHICS_PRESETS: GraphicsPresetDef[] = [
  {
    id: "low",
    name: "Low",
    tagline: "Best speed",
    description: "Very simple graphics for old or weak laptops. Everything decorative is off; gameplay stays crisp.",
    performanceMode: "low",
    shadowIntensity: 10,
    animationIntensity: 10,
  },
  {
    id: "medium",
    name: "Medium",
    tagline: "Balanced",
    description: "Same beautiful look, but nothing repaints every frame. Great for most laptops.",
    performanceMode: "medium",
    shadowIntensity: 60,
    animationIntensity: 70,
  },
  {
    id: "high",
    name: "High",
    tagline: "Best visuals",
    description: "Every glow, shadow and ambient animation on. For powerful PCs.",
    performanceMode: "high",
    shadowIntensity: 85,
    animationIntensity: 100,
  },
];

/** Maps a rendering tier to the preset that represents it. */
export function performanceToQuality(mode: PerformanceMode): GraphicsQuality {
  return mode;
}

/**
 * Guess the best mode for this device on first visit. Runs once, only when
 * the user has never saved a preference.
 */
export function detectPerformanceMode(): PerformanceMode {
  if (typeof navigator === "undefined") {
    return "medium";
  }
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4; // GB; Chrome/Edge only, else 4.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia != null &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || cores <= 2 || memory <= 2) {
      return "low";
    }
    if (cores <= 4 || memory <= 4) {
      return "medium";
    }
    return "high";
  } catch {
    return "medium";
  }
}

export function getBoardTheme(id: string): BoardThemeDef {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

export function getCheckerTheme(id: string): CheckerThemeDef {
  return CHECKER_THEMES.find((t) => t.id === id) ?? CHECKER_THEMES[0];
}

export function getBackgroundTheme(id: string): BackgroundThemeDef {
  return BACKGROUND_THEMES.find((t) => t.id === id) ?? BACKGROUND_THEMES[0];
}

/****************************
 * Application to CSS vars   *
 ****************************/

export type VisualSettings = {
  boardTheme: string;
  checkerTheme: string;
  backgroundTheme: string;
  shadowIntensity: number;
  animationIntensity: number;
  performanceMode: PerformanceMode;
  optShadows: boolean;
  optAmbient: boolean;
  optGlow: boolean;
  optGrain: boolean;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Writes all theme CSS custom properties onto :root. Safe to call on every
 * settings change; the browser only repaints what actually changed.
 */
export function applyVisualSettings(s: VisualSettings): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const set = (name: string, value: string) => {
    root.style.setProperty(name, value);
  };

  // --- Board theme ---
  const b = getBoardTheme(s.boardTheme);
  set("--frame-grad", `linear-gradient(to bottom, ${b.frameLight}, ${b.frameDark})`);
  set("--field-grad", `linear-gradient(to bottom, ${b.fieldLight}, ${b.fieldDark})`);
  set("--point-a", b.pointA);
  set("--point-b", b.pointB);
  set("--point-a-edge", b.pointAEdge);
  set("--point-b-edge", b.pointBEdge);
  set("--bar-grad", `linear-gradient(to bottom, ${b.barLight}, ${b.barDark})`);
  set("--home-grad", `linear-gradient(to bottom, ${b.homeLight}, ${b.homeDark})`);
  set("--hinge-grad", `linear-gradient(to bottom, ${b.hingeLight}, ${b.hingeDark} 55%, ${b.hingeDark})`);
  set("--highlight-color", b.highlight);
  set("--vignette-alpha", String(b.vignette));

  // Green used for move affordances: movable checkers + legal destinations.
  // Kept theme-independent so the affordance always reads as "green = can go".
  set("--move-color", MOVE_HIGHLIGHT.color);
  set("--move-color-rgb", MOVE_HIGHLIGHT.rgb);

  // Player cards tinted from the frame wood so the room feels cohesive.
  set("--card-grad", `linear-gradient(160deg, ${b.frameLight}, ${b.frameDark})`);
  set(
    "--card-grad-bottom",
    `linear-gradient(160deg, ${b.frameLight}, ${b.frameDark})`
  );
  set("--card-border", b.frameDark);
  set("--card-glow", b.hingeLight);

  // --- Checker set ---
  const c = getCheckerTheme(s.checkerTheme);
  set("--checker-a", svgUri(checkerSVG(c.a, false)));
  set("--checker-a-sel", svgUri(checkerSVG(c.a, true)));
  set("--checker-a-move", svgUri(checkerSVG(c.a, false, true)));
  set("--checker-b", svgUri(checkerSVG(c.b, false)));
  set("--checker-b-sel", svgUri(checkerSVG(c.b, true)));
  set("--checker-b-move", svgUri(checkerSVG(c.b, false, true)));
  set("--checker-home-a", svgUri(checkerHomeSVG(c.a)));
  set("--checker-home-b", svgUri(checkerHomeSVG(c.b)));

  // --- Background theme ---
  const bg = getBackgroundTheme(s.backgroundTheme);
  set("--app-bg", bg.bg);
  set("--circle-color", bg.circle + "24");

  // --- Advanced graphics switches ---
  // Board texture off: swap the procedural noise tiles for "none" layers so
  // nothing textured is rasterized at all (lightest option for weak GPUs).
  const grain = s.optGrain !== false;
  set("--wood-grain", grain ? WOOD_GRAIN_URI : "none");
  set("--field-grain", grain ? FIELD_GRAIN_URI : "none");

  // --- Effect sliders ---
  const shadow = clamp01(s.shadowIntensity / 100);
  const anim = clamp01(s.animationIntensity / 100);

  set("--shadow-scale", String(0.35 + 1.15 * shadow));
  set("--shadow-alpha", String(0.75 * shadow));
  set("--checker-shadow-alpha", String(0.65 * shadow));
  set("--vignette-scale", String(0.4 + 0.6 * shadow));

  // Animation intensity drives ambient motion + glow pulsing + hover pop.
  set("--anim-scale", String(anim));
  set("--hover-scale", String(1 + 0.12 * anim));
  set("--glow-min", String(0.35 + 0.15 * anim));
  set("--glow-max", String(0.55 + 0.45 * anim));

  // Hard-kill all looping animations when the slider is at zero.
  document.body.classList.toggle("fx-off", anim <= 0.001);

  // Performance mode: cheap rendering tiers for weak devices. "medium" keeps
  // every visual feature but removes all per-frame repaint work; "low"
  // additionally removes filters and ambient layers entirely.
  const mode: PerformanceMode = s.performanceMode ?? "medium";
  document.body.classList.toggle("perf-med", mode !== "high");
  document.body.classList.toggle("perf-low", mode === "low");

  // Individual graphics switches (game-style advanced options) layered on
  // top of the preset. Each one maps to a body class consumed in App.scss.
  document.body.classList.toggle("no-shadows", s.optShadows === false);
  document.body.classList.toggle("no-ambient", s.optAmbient === false);
  document.body.classList.toggle("no-glow", s.optGlow === false);
}

export function colorToCssGradientOfChecker(
  themeId: string,
  color: Color
): string {
  const t = getCheckerTheme(themeId);
  const c = color === Color.White ? t.a : t.b;
  return `radial-gradient(circle at 38% 30%, ${c.light}, ${c.mid} 55%, ${c.dark})`;
}

export { WOOD_GRAIN_URI, FIELD_GRAIN_URI };
