import { Auth, User, getAuth, signInAnonymously } from "firebase/auth";

import { FirebaseApp, initializeApp } from "firebase/app";
import {
  DocumentReference,
  FieldValue,
  Firestore,
  Timestamp,
  addDoc,
  and,
  collection,
  getDocs,
  getFirestore,
  limit,
  or,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { GameState } from "./store/gameStateSlice";
import { PlayersDataPayload } from "./store/playersSlice";
import { performInitialRolls, rollDiceImpl } from "./store/dice";
import { DiceData } from "./store/diceSlice";
import { GameBoardState, Player } from "./Types";
import { STARTING_BOARD_STATE } from "./Constants";
import { NetworkedMovesPayload } from "./store/animatableMovesSlice";
import {
  InitialReadyForNextGameData,
  ReadyForNextGameData,
} from "./store/readyForNextGameSlice";
import {
  DoublingCubeData,
  InitialDoublingCubeState,
} from "./store/doublingCubeSlice";
import { InitialMatchScoreState, MatchScore } from "./store/matchScoreSlice";

// The Firebase web app configuration is read from environment variables so
// this deployment is not tied to the original author's Firebase project.
//
// - Local development: copy .env.example to .env and fill in the values from
//   Firebase console -> Project settings -> General -> Your apps -> SDK setup.
// - Vercel: set the same variables under Project -> Settings -> Environment
//   Variables, then redeploy.
//
// Note: in Create React App, only variables prefixed with REACT_APP_ are
// embedded into the client bundle at build time.
const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

let initialized: boolean = false;
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function initialize() {
  if (initialized) {
    return;
  }

  const missingEnvVars = Object.entries(FIREBASE_CONFIG)
    .filter(([key, value]) => key !== "measurementId" && !value)
    .map(([key]) => `REACT_APP_FIREBASE_${camelCaseToScreamingSnake(key)}`);

  if (missingEnvVars.length > 0) {
    throw new Error(
      "Firebase configuration is missing. Set the following environment " +
        "variables (see .env.example), then rebuild: " +
        missingEnvVars.join(", ")
    );
  }

  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  initialized = true;
}

function camelCaseToScreamingSnake(name: string): string {
  return name.replace(/([A-Z])/g, "_$1").toUpperCase();
}

export function createRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var result = "";
  for (var i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getDB(): Firestore {
  initialize();
  return db;
}

export async function signIn(): Promise<User> {
  initialize();

  if (auth.currentUser != null) {
    return auth.currentUser;
  }

  const userCredential = await signInAnonymously(auth);
  return userCredential.user;
}

export function getCurrentUser(): User {
  initialize();

  if (auth.currentUser != null) {
    return auth.currentUser;
  }

  throw Error("Trying to access current user without signing in.");
}

export type FirestoreGameData = {
  gameBoard: GameBoardState;
  gameState: GameState;
  players: PlayersDataPayload;
  currentPlayer: Player;
  dice: DiceData;
  networkedMoves: NetworkedMovesPayload | null;
  roomCode: string;
  doublingCube: DoublingCubeData;
  matchScore: MatchScore;
  readyForNextGame: ReadyForNextGameData;
  timeCreated: FieldValue;
};

type CreateLobbyResult = {
  roomCode: string;
  docRef: DocumentReference;
};

export async function createLobby(): Promise<CreateLobbyResult> {
  initialize();

  const roomCode = createRoomCode();
  const initialRolls = performInitialRolls();
  const startingRoll = initialRolls[Object.keys(initialRolls).length - 1];

  const initialGameData: FirestoreGameData = {
    roomCode: roomCode,
    gameBoard: STARTING_BOARD_STATE,
    gameState: GameState.WaitingForPlayers,
    players: {
      playerOne: {
        uid: (await signIn()).uid,
      },
      playerTwo: null,
    },
    currentPlayer: startingRoll[0] > startingRoll[1] ? Player.One : Player.Two,
    dice: {
      initialRolls: initialRolls,
      currentRoll: startingRoll,
    },
    networkedMoves: null,
    doublingCube: InitialDoublingCubeState,
    matchScore: InitialMatchScoreState,
    readyForNextGame: InitialReadyForNextGameData,
    timeCreated: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "lobbies"), initialGameData);

  return {
    roomCode,
    docRef,
  };
}

export async function findLobby(
  roomCode: string
): Promise<DocumentReference | null> {
  initialize();

  const lobbiesRef = collection(db, "lobbies");
  const timestampSixHoursAgo = Timestamp.fromDate(
    new Date(Date.now() - 6 * 60 * 60 * 1000)
  );
  const uid = (await signIn()).uid;
  const q = query(
    lobbiesRef,
    and(
      where("roomCode", "==", roomCode),
      where("timeCreated", ">=", timestampSixHoursAgo),
      or(
        where("players.playerOne.uid", "==", uid),
        where("players.playerTwo", "==", null),
        where("players.playerTwo.uid", "==", uid)
      )
    ),
    orderBy("timeCreated", "desc"),
    limit(1)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0].ref;
}

export async function joinLobbyAsPlayerTwo(docRef: DocumentReference) {
  return await setDoc(
    docRef,
    {
      gameState: GameState.WaitingToBegin,
      players: {
        playerTwo: {
          uid: getCurrentUser().uid,
        },
      },
    },
    { merge: true }
  );
}

export function hasJoinedLobby(playersData: PlayersDataPayload): boolean {
  let uid = getCurrentUser().uid;
  return (
    (playersData.playerOne != null && playersData.playerOne.uid === uid) ||
    (playersData.playerTwo != null && playersData.playerTwo.uid === uid)
  );
}

export async function writeNewGameStateToDB(
  docRef: DocumentReference,
  newGameState: GameState
) {
  return await setDoc(
    docRef,
    {
      gameState: newGameState,
    },
    { merge: true }
  );
}

export async function writeEndTurnToDB(
  docRef: DocumentReference,
  newGameBoardState: GameBoardState,
  newCurrentPlayer: Player,
  networkedMoves: NetworkedMovesPayload
) {
  return await setDoc(
    docRef,
    {
      gameBoard: newGameBoardState,
      currentPlayer: newCurrentPlayer,
      dice: {
        currentRoll: rollDiceImpl(),
      },
      gameState: GameState.PlayerRolling,
      networkedMoves,
    },
    { merge: true }
  );
}

export async function writeGameOverToDB(
  docRef: DocumentReference,
  newGameBoardState: GameBoardState,
  winningGameState:
    | GameState.GameOver
    | GameState.GameOverGammon
    | GameState.GameOverBackgammon
    | GameState.GameOverForfeit,
  newMatchScore: MatchScore,
  networkedMoves: NetworkedMovesPayload
) {
  return await setDoc(
    docRef,
    {
      gameBoard: newGameBoardState,
      gameState: winningGameState,
      networkedMoves,
      matchScore: newMatchScore,
    },
    { merge: true }
  );
}

export async function writeForfeitToDB(
  docRef: DocumentReference,
  newGameBoardState: GameBoardState,
  newMatchScore: MatchScore
) {
  return await setDoc(
    docRef,
    {
      gameBoard: newGameBoardState,
      gameState: GameState.GameOverForfeit,
      matchScore: newMatchScore,
    },
    { merge: true }
  );
}

export async function writeAcceptDoubleToDB(
  docRef: DocumentReference,
  newDoublingCubeData: DoublingCubeData
) {
  return await setDoc(
    docRef,
    {
      gameState: GameState.PlayerRolling,
      doublingCube: newDoublingCubeData,
    },
    { merge: true }
  );
}

export async function writeAutomaticDoubleToDB(docRef: DocumentReference) {
  return await setDoc(
    docRef,
    {
      doublingCube: {
        owner: null,
        gameStakes: 2,
      },
    },
    { merge: true }
  );
}

export async function writeMatchSettingsToDB(
  docRef: DocumentReference,
  pointsRequiredToWin: number,
  enableDoubling: boolean
) {
  return await setDoc(
    docRef,
    {
      matchScore: {
        pointsRequiredToWin: pointsRequiredToWin,
      },
      doublingCube: {
        owner: null,
        gameStakes: 1,
        enabled: enableDoubling,
      },
    },
    { merge: true }
  );
}

export async function writePlayerReadyForNextGameToDB(
  docRef: DocumentReference,
  newReadyForNextGameData: ReadyForNextGameData
) {
  return await setDoc(
    docRef,
    {
      readyForNextGame: newReadyForNextGameData,
    },
    { merge: true }
  );
}

export async function writeNewGameStartToDB(docRef: DocumentReference) {
  const initialRolls = performInitialRolls();
  const startingRoll = initialRolls[Object.keys(initialRolls).length - 1];

  return await setDoc(
    docRef,
    {
      gameBoard: STARTING_BOARD_STATE,
      gameState: GameState.WaitingToBegin,
      currentPlayer:
        startingRoll[0] > startingRoll[1] ? Player.One : Player.Two,
      dice: {
        initialRolls: initialRolls,
        currentRoll: startingRoll,
      },
      networkedMoves: null,
      doublingCube: {
        owner: null,
        gameStakes: 1,
      },
      readyForNextGame: InitialReadyForNextGameData,
    },
    { merge: true }
  );
}
