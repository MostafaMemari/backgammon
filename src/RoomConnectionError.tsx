import { FunctionComponent } from "react";
import { resetLocalStore } from "./Utils";
import { useAppDispatch } from "./store/hooks";
import { setWipeTransition } from "./store/wipeTransitionSlice";
import { useNavigate } from "react-router-dom";

export enum RoomConnectionErrorType {
  None = "None",
  NotFound = "NotFound",
  TooManyPlayers = "TooManyPlayers",
  ConnectionFailed = "ConnectionFailed",
}

type RoomConnectionErrorProps = {
  type: RoomConnectionErrorType;
  roomCode: string;
  detail?: string;
};

const RoomConnectionError: FunctionComponent<RoomConnectionErrorProps> = ({
  type,
  roomCode,
  detail,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  let headerText = null;
  let errorText = null;
  if (type === RoomConnectionErrorType.NotFound) {
    headerText = "Room Not Found";
    errorText = "Could not find room with code: ";
  } else if (type === RoomConnectionErrorType.TooManyPlayers) {
    headerText = "Room Full";
    errorText = "Two players have already connected to room: ";
  } else {
    headerText = "Connection Failed";
    errorText = "Could not connect to room: ";
  }

  return (
    <div className={"Room-connection-error-wrapper"}>
      <div className={"Room-connection-error-header"}>{headerText}</div>
      <div className={"Room-connection-error-text"}>
        {errorText}
        {<span className={"Room-connection-error-roomcode"}>{roomCode}</span>}
      </div>
      <div className={"Room-connection-error-subtext"}>
        {type === RoomConnectionErrorType.ConnectionFailed
          ? "Check your internet connection and try again."
          : "Please double check the code or try creating another room."}
      </div>
      {detail != null && (
        <div className={"Room-connection-error-subtext"}>{detail}</div>
      )}
      <div className={"Room-connection-error-menu-button-wrapper"}>
        <button
          className={"Room-connection-error-menu-button"}
          onClick={() => {
            resetLocalStore(dispatch, true);
            dispatch(setWipeTransition(true));
            navigate("/");
          }}
        >
          Return To Menu
        </button>
      </div>
    </div>
  );
};

export default RoomConnectionError;
