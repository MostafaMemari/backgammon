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

  const initialFloatingCircles = new Array(50);
  for (let i = 0; i < 50; i++) {
    initialFloatingCircles.push(
      <div key={i} className={"Initial-floating-circle"} />
    );
  }

  const floatingCircles = new Array(50);
  for (let i = 0; i < 50; i++) {
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
