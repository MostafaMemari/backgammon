import { FunctionComponent, useEffect } from "react";
import cx from "classnames";
import "./App.scss";

import MainMenu from "./MainMenu";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import NetworkedGameRoom, {
  loader as NetworkedGameRoomLoader,
} from "./NetworkedGameRoom";
import LocalGameRoom from "./LocalGameRoom";
import WipeTransition from "./WipeTransition";
import { useAppSelector } from "./store/hooks";
import { applyVisualSettings } from "./themes";

type AppProps = {};

const App: FunctionComponent<AppProps> = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <MainMenu />,
    },
    {
      path: "/local",
      element: <LocalGameRoom />,
    },
    {
      path: "/:roomCode",
      element: <NetworkedGameRoom />,
      loader: NetworkedGameRoomLoader,
    },
  ]);

  // Push the user's selected themes and effect intensities into CSS custom
  // properties. Re-running this on every settings change is cheap.
  const settings = useAppSelector((state) => state.settings);
  useEffect(() => {
    applyVisualSettings(settings);
  }, [settings]);

  // Ambient floating circles are pure decoration. Render far fewer of them
  // (or none) on weaker devices - 100 slowly animating layers is one of the
  // heaviest things on the page for an old laptop GPU. The advanced graphics
  // switch (optAmbient) can also turn them off in any preset.
  const ambientOn = settings.optAmbient !== false;
  const circleCount = !ambientOn
    ? 0
    : settings.performanceMode === "low"
    ? 0
    : settings.performanceMode === "medium"
    ? 14
    : 50;

  const initialFloatingCircles = [];
  const floatingCircles = [];
  for (let i = 0; i < circleCount; i++) {
    initialFloatingCircles.push(
      <div key={i} className={"Initial-floating-circle"} />
    );
    floatingCircles.push(<div key={i} className={"Floating-circle"} />);
  }

  return (
    <div className={cx("App-wrapper")}>
      <WipeTransition />
      <div>{initialFloatingCircles}</div>
      <div>{floatingCircles}</div>
      <RouterProvider router={router} />
    </div>
  );
};

export default App;
