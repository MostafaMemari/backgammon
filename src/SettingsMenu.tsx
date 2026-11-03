import cx from "classnames";
import { FunctionComponent, useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

import Checker, { CheckerStatus } from "./Checker";
import { Color, MovementDirection, Player } from "./Types";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  setAnimationIntensity,
  applyGraphicsPreset,
  setOptAmbient,
  setOptGlow,
  setOptGrain,
  setOptShadows,
  setBackgroundTheme,
  setBoardTheme,
  setCheckerTheme,
  setMovementDirection,
  setPlayerOneColor,
  setShadowIntensity,
  setShowSettingsMenu,
  setSoundEnabled,
  setSoundVolume,
} from "./store/settingsSlice";
import { ActionsContext, LocalGameActions } from "./ActionsContext";
import {
  BACKGROUND_THEMES,
  BOARD_THEMES,
  CHECKER_THEMES,
  GRAPHICS_PRESETS,
  getCheckerTheme,
  detectPerformanceMode,
} from "./themes";

type SettingsMenuProps = {
  playerPerspective: Player;
};

enum SettingsTab {
  Checkers = "CHECKERS",
  Board = "BOARD",
  Background = "BACKGROUND",
  Effects = "EFFECTS",
  Sound = "SOUND",
}

const SettingsMenu: FunctionComponent<SettingsMenuProps> = ({
  playerPerspective,
}) => {
  const settings = useAppSelector((state) => state.settings);
  let actions = useContext(ActionsContext);
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<SettingsTab>(SettingsTab.Checkers);

  let playerOneColor = settings.playerOneColor;
  let playerTwoColor =
    playerOneColor === Color.White ? Color.Black : Color.White;

  const closeDialog = () => dispatch(setShowSettingsMenu(false));
  const togglePlayerColor = () => {
    const newColor =
      settings.playerOneColor === Color.Black ? Color.White : Color.Black;
    dispatch(setPlayerOneColor(newColor));
  };
  const toggleMovementDirection = () => {
    const newDirection =
      settings.movementDirection === MovementDirection.Clockwise
        ? MovementDirection.CounterClockwise
        : MovementDirection.Clockwise;
    dispatch(setMovementDirection(newDirection));
  };

  let firstPlayerLabel = "";
  let secondPlayerLabel = "";
  let firstPlayerColor =
    playerPerspective === Player.One ? playerOneColor : playerTwoColor;
  let secondPlayerColor =
    firstPlayerColor === Color.White ? Color.Black : Color.White;
  if (actions instanceof LocalGameActions) {
    firstPlayerLabel =
      playerPerspective === Player.One ? "Player 1" : "Player 2";
    secondPlayerLabel =
      playerPerspective === Player.One ? "Player 2" : "Player 1";
  } else {
    firstPlayerLabel = "You";
    secondPlayerLabel = "Opponent";
  }

  const checkerPair = (themeId: string) => {
    const t = getCheckerTheme(themeId);
    const gradA = `radial-gradient(circle at 36% 30%, ${t.a.light}, ${t.a.mid} 58%, ${t.a.dark})`;
    const gradB = `radial-gradient(circle at 36% 30%, ${t.b.light}, ${t.b.mid} 58%, ${t.b.dark})`;
    return (
      <div className={"Settings-checker-pair"}>
        <div
          className={"pair-checker first"}
          style={{
            background: gradA,
            boxShadow: `inset 0 0 0 1px ${t.a.edge}, 0 1px 2px rgba(0,0,0,0.5)`,
          }}
        />
        <div
          className={"pair-checker second"}
          style={{
            background: gradB,
            boxShadow: `inset 0 0 0 1px ${t.b.edge}, 0 1px 2px rgba(0,0,0,0.5)`,
          }}
        />
      </div>
    );
  };

  const boardPreview = (themeId: string) => {
    const t = BOARD_THEMES.find((b) => b.id === themeId)!;
    return (
      <div
        className={"Settings-board-preview"}
        style={{
          background: `linear-gradient(to bottom, ${t.frameLight}, ${t.frameDark})`,
        }}
      >
        <div
          className={"mini-field"}
          style={{
            background: `linear-gradient(to bottom, ${t.fieldLight}, ${t.fieldDark})`,
          }}
        >
          <div
            className={"mini-triangle a"}
            style={{ background: t.pointA }}
          />
          <div
            className={"mini-triangle b"}
            style={{ background: t.pointB }}
          />
        </div>
      </div>
    );
  };

  const bgPreview = (themeId: string) => {
    const t = BACKGROUND_THEMES.find((b) => b.id === themeId)!;
    return (
      <div
        className={"Settings-board-preview"}
        style={{ background: t.bg }}
      >
        <div
          style={{
            background: `radial-gradient(circle at 70% 30%, ${t.circle}55, transparent 60%)`,
            height: "100%",
            width: "100%",
          }}
        />
      </div>
    );
  };

  const checkerTab = (
    <>
      <div className={"Settings-section-title"}>Checker set</div>
      <div className={"Settings-theme-grid"}>
        {CHECKER_THEMES.map((t) => (
          <div
            key={t.id}
            className={cx("Settings-theme-chip", {
              selected: settings.checkerTheme === t.id,
            })}
            onClick={() => dispatch(setCheckerTheme(t.id))}
          >
            <div className={"Settings-chip-preview"}>{checkerPair(t.id)}</div>
            <div className={"Settings-chip-name"}>{t.name}</div>
          </div>
        ))}
      </div>
      <div className={"Settings-option-row"}>
        <div className={"Settings-checker-color-label"}>Your checkers</div>
        <div
          className={"Settings-menu-player-names-and-checkers"}
          onClick={togglePlayerColor}
        >
          <div className={"Settings-menu-player-name-and-checker"}>
            <div className={"Settings-menu-player-name"}>
              {firstPlayerLabel}
            </div>
            <div className={"Settings-menu-checker-wrapper"}>
              <Checker
                color={firstPlayerColor}
                checkerPulse={false}
                status={CheckerStatus.None}
                onAnimationComplete={() => {}}
                animation={null}
              />
            </div>
          </div>
          <div className={"Settings-menu-color-swap-arrow-wrapper"}>
            <div className={"Settings-menu-color-swap"}>SWAP</div>
            <div className={"Settings-menu-color-swap-arrow"} />
          </div>
          <div className={"Settings-menu-player-name-and-checker"}>
            <div className={"Settings-menu-player-name"}>
              {secondPlayerLabel}
            </div>
            <div className={"Settings-menu-checker-wrapper"}>
              <Checker
                color={secondPlayerColor}
                checkerPulse={false}
                status={CheckerStatus.None}
                onAnimationComplete={() => {}}
                animation={null}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={"Settings-option-row bottom"}>
        <div className={"Settings-checker-direction-label"}>
          Movement direction
        </div>
        <div
          className={"Settings-option-movement-diagram-wrapper"}
          onClick={toggleMovementDirection}
        >
          <div
            className={cx("Settings-option-movement-diagram", {
              light: firstPlayerColor === Color.White,
              dark: firstPlayerColor === Color.Black,
              cw:
                (playerPerspective === Player.One &&
                  settings.movementDirection ===
                    MovementDirection.Clockwise) ||
                (playerPerspective === Player.Two &&
                  settings.movementDirection ===
                    MovementDirection.CounterClockwise),
            })}
          />
        </div>
      </div>
    </>
  );

  const boardTab = (
    <>
      <div className={"Settings-section-title"}>Board theme</div>
      <div className={"Settings-theme-grid"}>
        {BOARD_THEMES.map((t) => (
          <div
            key={t.id}
            className={cx("Settings-theme-chip", {
              selected: settings.boardTheme === t.id,
            })}
            onClick={() => dispatch(setBoardTheme(t.id))}
          >
            <div className={"Settings-chip-preview"}>{boardPreview(t.id)}</div>
            <div className={"Settings-chip-name"}>{t.name}</div>
          </div>
        ))}
      </div>
    </>
  );

  const backgroundTab = (
    <>
      <div className={"Settings-section-title"}>Background</div>
      <div className={"Settings-theme-grid"}>
        {BACKGROUND_THEMES.map((t) => (
          <div
            key={t.id}
            className={cx("Settings-theme-chip", {
              selected: settings.backgroundTheme === t.id,
            })}
            onClick={() => dispatch(setBackgroundTheme(t.id))}
          >
            <div className={"Settings-chip-preview"}>{bgPreview(t.id)}</div>
            <div className={"Settings-chip-name"}>{t.name}</div>
          </div>
        ))}
      </div>
    </>
  );

  const effectsTab = (
    <>
      <div className={"Settings-section-title with-action"}>
        <span>Graphics quality</span>
        <div
          className={"Settings-auto-btn"}
          title={"Pick the best quality for this device automatically"}
          onClick={() => dispatch(applyGraphicsPreset(detectPerformanceMode()))}
        >
          Auto-detect
        </div>
      </div>
      <div className={"Settings-quality-grid"}>
        {GRAPHICS_PRESETS.map((p) => (
          <div
            key={p.id}
            className={cx("Settings-quality-card", {
              selected: settings.graphicsQuality === p.id,
            })}
            onClick={() => dispatch(applyGraphicsPreset(p.id))}
          >
            {settings.graphicsQuality === p.id ? (
              <div className={"Settings-quality-check"}>✓</div>
            ) : null}
            <div className={"Settings-quality-name"}>{p.name}</div>
            <div className={"Settings-quality-tagline"}>{p.tagline}</div>
            <div className={"Settings-quality-desc"}>{p.description}</div>
          </div>
        ))}
      </div>
      {settings.graphicsQuality === "custom" ? (
        <div className={"Settings-custom-note"}>
          Custom — you fine-tuned a preset. Pick a card above to reset.
        </div>
      ) : null}
      <div className={"Settings-section-title"}>Advanced graphics</div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Shadows</div>
        <div
          className={cx("Settings-sound-toggle", {
            on: settings.optShadows !== false,
          })}
          onClick={() =>
            dispatch(setOptShadows(settings.optShadows === false))
          }
        >
          <div className={"Settings-sound-toggle-knob"} />
          <div className={"Settings-sound-toggle-text"}>
            {settings.optShadows !== false ? "ON" : "OFF"}
          </div>
        </div>
      </div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Ambient background</div>
        <div
          className={cx("Settings-sound-toggle", {
            on: settings.optAmbient !== false,
          })}
          onClick={() =>
            dispatch(setOptAmbient(settings.optAmbient === false))
          }
        >
          <div className={"Settings-sound-toggle-knob"} />
          <div className={"Settings-sound-toggle-text"}>
            {settings.optAmbient !== false ? "ON" : "OFF"}
          </div>
        </div>
      </div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Glow effects</div>
        <div
          className={cx("Settings-sound-toggle", {
            on: settings.optGlow !== false,
          })}
          onClick={() => dispatch(setOptGlow(settings.optGlow === false))}
        >
          <div className={"Settings-sound-toggle-knob"} />
          <div className={"Settings-sound-toggle-text"}>
            {settings.optGlow !== false ? "ON" : "OFF"}
          </div>
        </div>
      </div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Board texture</div>
        <div
          className={cx("Settings-sound-toggle", {
            on: settings.optGrain !== false,
          })}
          onClick={() => dispatch(setOptGrain(settings.optGrain === false))}
        >
          <div className={"Settings-sound-toggle-knob"} />
          <div className={"Settings-sound-toggle-text"}>
            {settings.optGrain !== false ? "ON" : "OFF"}
          </div>
        </div>
      </div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Shadow depth</div>
        <input
          className={"Settings-slider"}
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.shadowIntensity}
          style={{ "--fill": `${settings.shadowIntensity}%` } as any}
          onChange={(e) =>
            dispatch(setShadowIntensity(Number(e.target.value)))
          }
        />
        <div className={"Settings-slider-value"}>
          {settings.shadowIntensity}%
        </div>
      </div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Animation intensity</div>
        <input
          className={"Settings-slider"}
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.animationIntensity}
          style={{ "--fill": `${settings.animationIntensity}%` } as any}
          onChange={(e) =>
            dispatch(setAnimationIntensity(Number(e.target.value)))
          }
        />
        <div className={"Settings-slider-value"}>
          {settings.animationIntensity}%
        </div>
      </div>
      <div className={"Settings-hint"}>
        Quality presets work like the graphics menu in PC games: pick Low on
        a weak laptop for the simplest possible look, Medium for a fast but
        still rich scene, High for everything. The advanced switches and
        sliders fine-tune any preset — for example keep shadows but turn
        off ambient motion. Everything applies instantly and is saved on
        this device.
      </div>
    </>
  );
  const soundTab = (
    <>
      <div className={"Settings-section-title"}>Sound</div>
      <div className={"Settings-slider-row"}>
        <div className={"Settings-slider-label"}>Sound effects</div>
        <div
          className={cx("Settings-sound-toggle", {
            on: settings.soundEnabled,
          })}
          onClick={() => dispatch(setSoundEnabled(!settings.soundEnabled))}
        >
          <div className={"Settings-sound-toggle-knob"} />
          <div className={"Settings-sound-toggle-text"}>
            {settings.soundEnabled ? "ON" : "OFF"}
          </div>
        </div>
      </div>
      {settings.soundEnabled ? (
        <div className={"Settings-slider-row"}>
          <div className={"Settings-slider-label"}>Sound volume</div>
          <input
            className={"Settings-slider"}
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.soundVolume}
            style={{ "--fill": `${settings.soundVolume}%` } as any}
            onChange={(e) =>
              dispatch(setSoundVolume(Number(e.target.value)))
            }
          />
          <div className={"Settings-slider-value"}>{settings.soundVolume}%</div>
        </div>
      ) : null}
    </>
  );
  const tabButton = (tab: SettingsTab, label: string) => (
    <div
      key={tab}
      className={cx("Settings-tab", { active: activeTab === tab })}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </div>
  );

  return (
    <Modal
      show={settings.showSettingsMenu}
      centered={true}
      dialogClassName={"Settings-menu"}
      keyboard={true}
      onHide={closeDialog}
    >
      <Modal.Header closeButton>
        <Modal.Title>Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className={"Settings-tabs"}>
          {tabButton(SettingsTab.Checkers, "Checkers")}
          {tabButton(SettingsTab.Board, "Board")}
          {tabButton(SettingsTab.Background, "Background")}
          {tabButton(SettingsTab.Effects, "Effects")}
          {tabButton(SettingsTab.Sound, "Sound")}
        </div>
        <div className={"Settings-scroll-area"}>
          {activeTab === SettingsTab.Checkers ? checkerTab : null}
          {activeTab === SettingsTab.Board ? boardTab : null}
          {activeTab === SettingsTab.Background ? backgroundTab : null}
          {activeTab === SettingsTab.Effects ? effectsTab : null}
          {activeTab === SettingsTab.Sound ? soundTab : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={closeDialog}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SettingsMenu;
