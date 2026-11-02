// Online multiplayer lobby client.
//
// The browser never talks to Firebase or Google endpoints directly. Instead
// it calls the same-origin /api/* serverless functions (see the /api folder
// in the repo root), which proxy to Cloud Firestore from Vercel's servers.
// This keeps online play working from networks where Google's API endpoints
// are unreachable (e.g. Iran) and removes the need for client-side Firebase
// authentication entirely.
//
// Behaviour matches the previous Firebase SDK implementation:
// - Lobby documents live in the "lobbies" collection, keyed by the 4-letter
//   room code (direct document reads, no queries or composite indexes).
// - Updates merge down to leaf fields, mirroring setDoc(..., {merge: true}).
// - subscribeToLobby() replaces Firestore's onSnapshot(): it polls the lobby
//   and only notifies listeners when the document actually changed.

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

// ---------------------------------------------------------------------------
// Local player identity
//
// The previous implementation used Firebase anonymous auth to give each
// browser a stable uid. We now generate a random uid once and persist it in
// localStorage, which serves the same purpose: recognising a client when it
// reconnects to a lobby it created or joined.
// ---------------------------------------------------------------------------

const LOCAL_UID_STORAGE_KEY = "backgammon_local_uid";

let cachedLocalUid: string | null = null;

function createRandomUid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function getLocalUid(): string {
  if (cachedLocalUid != null) {
    return cachedLocalUid;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_UID_STORAGE_KEY);
    if (stored) {
      cachedLocalUid = stored;
      return cachedLocalUid;
    }
  } catch (storageError) {
    console.warn("localStorage is unavailable:", storageError);
  }

  cachedLocalUid = createRandomUid();
  try {
    window.localStorage.setItem(LOCAL_UID_STORAGE_KEY, cachedLocalUid);
  } catch (storageError) {
    console.warn("localStorage is unavailable:", storageError);
  }

  return cachedLocalUid;
}

export type SignedInUser = {
  uid: string;
};

// Kept for call-site compatibility with the previous Firebase implementation.
export async function signIn(): Promise<SignedInUser> {
  return { uid: getLocalUid() };
}

export function getCurrentUser(): SignedInUser {
  return { uid: getLocalUid() };
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export type LobbyRef = {
  roomCode: string;
};

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
  timeCreated?: string;
};

type CreateLobbyResult = {
  roomCode: string;
  docRef: LobbyRef;
};

type LobbyResponse = {
  found: boolean;
  roomCode?: string;
  data?: FirestoreGameData;
};

// ---------------------------------------------------------------------------
// API transport
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10000;

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init && init.headers ? init.headers : {}),
      },
    });
  } catch (fetchError) {
    if (
      fetchError instanceof Error &&
      fetchError.name === "AbortError"
    ) {
      throw new ApiError(0, "Request timed out.");
    }
    throw fetchError;
  } finally {
    window.clearTimeout(timeoutId);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (parseError) {
    body = null;
  }

  if (!response.ok) {
    const bodyFields =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      typeof bodyFields.error === "string"
        ? bodyFields.error
        : `Request failed with status ${response.status}`;
    const detail =
      typeof bodyFields.detail === "string" ? ` (${bodyFields.detail})` : "";
    throw new ApiError(response.status, message + detail);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Lobby operations
// ---------------------------------------------------------------------------

export function createRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var result = "";
  for (var i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createLobby(): Promise<CreateLobbyResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = createRoomCode();
    const initialRolls = performInitialRolls();
    const startingRoll = initialRolls[Object.keys(initialRolls).length - 1];

    const initialGameData: Omit<FirestoreGameData, "timeCreated"> = {
      roomCode: roomCode,
      gameBoard: STARTING_BOARD_STATE,
      gameState: GameState.WaitingForPlayers,
      players: {
        playerOne: {
          uid: getLocalUid(),
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
    };

    try {
      await apiRequest<LobbyResponse>("/api/lobbies", {
        method: "POST",
        body: JSON.stringify({
          roomCode: roomCode,
          data: initialGameData,
        }),
      });
      return {
        roomCode: roomCode,
        docRef: { roomCode: roomCode },
      };
    } catch (error) {
      // 409 means the 4-letter code is already taken by a live room; try
      // another code. Any other error is a real failure.
      if (error instanceof ApiError && error.status === 409) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a free room code. Please try again.");
}

const LOBBY_EXPIRY_MS = 6 * 60 * 60 * 1000;

export async function findLobby(roomCode: string): Promise<LobbyRef | null> {
  let result: LobbyResponse;
  try {
    result = await apiRequest<LobbyResponse>(
      `/api/lobbies/${encodeURIComponent(roomCode)}`
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!result.found || result.data == null) {
    return null;
  }

  // Rooms expire after 6 hours, matching the previous behaviour.
  const timeCreatedMs = Date.parse(result.data.timeCreated || "");
  if (!Number.isNaN(timeCreatedMs) && Date.now() - timeCreatedMs > LOBBY_EXPIRY_MS) {
    return null;
  }

  return { roomCode: roomCode };
}

export async function joinLobbyAsPlayerTwo(docRef: LobbyRef) {
  return updateLobby(docRef, {
    gameState: GameState.WaitingToBegin,
    players: {
      playerTwo: {
        uid: getLocalUid(),
      },
    },
  });
}

export function hasJoinedLobby(playersData: PlayersDataPayload): boolean {
  let uid = getLocalUid();
  return (
    (playersData.playerOne != null && playersData.playerOne.uid === uid) ||
    (playersData.playerTwo != null && playersData.playerTwo.uid === uid)
  );
}

async function updateLobby(
  docRef: LobbyRef,
  data: Record<string, unknown>
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/api/lobbies/${encodeURIComponent(docRef.roomCode)}`,
    {
      method: "POST",
      body: JSON.stringify({ data }),
    }
  );
}

export async function writeNewGameStateToDB(
  docRef: LobbyRef,
  newGameState: GameState
) {
  return updateLobby(docRef, {
    gameState: newGameState,
  });
}

export async function writeEndTurnToDB(
  docRef: LobbyRef,
  newGameBoardState: GameBoardState,
  newCurrentPlayer: Player,
  networkedMoves: NetworkedMovesPayload
) {
  return updateLobby(docRef, {
    gameBoard: newGameBoardState,
    currentPlayer: newCurrentPlayer,
    dice: {
      currentRoll: rollDiceImpl(),
    },
    gameState: GameState.PlayerRolling,
    networkedMoves,
  });
}

export async function writeGameOverToDB(
  docRef: LobbyRef,
  newGameBoardState: GameBoardState,
  winningGameState:
    | GameState.GameOver
    | GameState.GameOverGammon
    | GameState.GameOverBackgammon,
  newMatchScore: MatchScore,
  networkedMoves: NetworkedMovesPayload
) {
  return updateLobby(docRef, {
    gameBoard: newGameBoardState,
    gameState: winningGameState,
    networkedMoves,
    matchScore: newMatchScore,
  });
}

export async function writeForfeitToDB(
  docRef: LobbyRef,
  newGameBoardState: GameBoardState,
  newMatchScore: MatchScore
) {
  return updateLobby(docRef, {
    gameBoard: newGameBoardState,
    gameState: GameState.GameOverForfeit,
    matchScore: newMatchScore,
  });
}

export async function writeAcceptDoubleToDB(
  docRef: LobbyRef,
  newDoublingCubeData: DoublingCubeData
) {
  return updateLobby(docRef, {
    gameState: GameState.PlayerRolling,
    doublingCube: newDoublingCubeData,
  });
}

export async function writeAutomaticDoubleToDB(docRef: LobbyRef) {
  return updateLobby(docRef, {
    doublingCube: {
      owner: null,
      gameStakes: 2,
    },
  });
}

export async function writeMatchSettingsToDB(
  docRef: LobbyRef,
  pointsRequiredToWin: number,
  enableDoubling: boolean
) {
  return updateLobby(docRef, {
    matchScore: {
      pointsRequiredToWin: pointsRequiredToWin,
    },
    doublingCube: {
      owner: null,
      gameStakes: 1,
      enabled: enableDoubling,
    },
  });
}

export async function writePlayerReadyForNextGameToDB(
  docRef: LobbyRef,
  newReadyForNextGameData: ReadyForNextGameData
) {
  return updateLobby(docRef, {
    readyForNextGame: newReadyForNextGameData,
  });
}

export async function writeNewGameStartToDB(docRef: LobbyRef) {
  const initialRolls = performInitialRolls();
  const startingRoll = initialRolls[Object.keys(initialRolls).length - 1];

  return updateLobby(docRef, {
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
  });
}

// ---------------------------------------------------------------------------
// Realtime-ish subscription (replaces Firestore's onSnapshot)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1200;
// Idle phases of a match don't need snappy updates, so poll slower there to
// save bandwidth and Firestore reads.
const SLOW_POLL_GAME_STATES = new Set<GameState>([
  GameState.WaitingForPlayers,
  GameState.WaitingToBegin,
  GameState.GameOver,
  GameState.GameOverGammon,
  GameState.GameOverBackgammon,
  GameState.GameOverForfeit,
]);
const SLOW_POLL_INTERVAL_MS = 3000;
const MAX_CONSECUTIVE_POLL_FAILURES = 3;

export function subscribeToLobby(
  docRef: LobbyRef,
  onData: (data: FirestoreGameData) => void,
  onError: (error: Error) => void
): () => void {
  let disposed = false;
  let timer: number | null = null;
  let consecutiveFailures = 0;
  let lastSerialized: string | null = null;
  let latestGameState: GameState | null = null;

  function scheduleNextPoll() {
    if (disposed) {
      return;
    }
    const interval =
      latestGameState != null && SLOW_POLL_GAME_STATES.has(latestGameState)
        ? SLOW_POLL_INTERVAL_MS
        : POLL_INTERVAL_MS;
    timer = window.setTimeout(() => {
      timer = null;
      poll();
    }, interval);
  }

  async function poll() {
    if (disposed) {
      return;
    }

    let result: LobbyResponse;
    try {
      result = await apiRequest<LobbyResponse>(
        `/api/lobbies/${encodeURIComponent(docRef.roomCode)}`
      );
    } catch (error) {
      if (disposed) {
        return;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        onError(
          error instanceof Error ? error : new Error(String(error))
        );
      } else {
        scheduleNextPoll();
      }
      return;
    }

    if (disposed) {
      return;
    }
    consecutiveFailures = 0;

    if (!result.found || result.data == null) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        onError(new Error("The room could not be found."));
      } else {
        scheduleNextPoll();
      }
      return;
    }

    // Only notify listeners when something actually changed, mirroring
    // Firestore's onSnapshot behaviour.
    const serialized = JSON.stringify(result.data);
    if (serialized !== lastSerialized) {
      lastSerialized = serialized;
      latestGameState = result.data.gameState;
      onData(result.data);
    }

    scheduleNextPoll();
  }

  poll();

  return () => {
    disposed = true;
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}
