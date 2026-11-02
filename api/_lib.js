// Shared helpers for the /api serverless functions.
//
// All Firestore traffic for online multiplayer goes through these functions so
// that browsers only ever talk to this Vercel domain. This keeps the game
// playable from networks where Google's API endpoints are unreachable (e.g.
// Iran), and it means clients never need Firebase credentials of their own.
//
// These functions intentionally have zero npm dependencies: they use the
// Node.js built-in global fetch (Node 18+) to call the Cloud Firestore REST
// API and the Firebase Auth REST API.

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.REACT_APP_FIREBASE_PROJECT_ID ||
  "backgammon-mostafa";

const API_KEY =
  process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY || "";

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ---------------------------------------------------------------------------
// Anonymous authentication
//
// The Firestore security rules only allow requests from signed-in users. The
// serverless functions sign in anonymously (via the Firebase Auth REST API)
// once per warm instance and reuse the resulting ID token for all proxied
// requests. If sign-in is unavailable, requests are still attempted without
// credentials, which works when the project's rules allow public access.
// ---------------------------------------------------------------------------

let cachedToken = null; // { token, expiresAtMs }

async function getIdToken() {
  if (!API_KEY) {
    return null;
  }

  // Refresh 5 minutes before expiry to avoid mid-request failures.
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
        API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data.idToken) {
      return null;
    }
    cachedToken = {
      token: data.idToken,
      expiresAtMs: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
    };
    return cachedToken.token;
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSON <-> Firestore REST value conversion
// ---------------------------------------------------------------------------

function jsonToFirestoreFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) {
      continue;
    }
    fields[key] = jsonToFirestoreValue(value);
  }
  return fields;
}

function jsonToFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsonToFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: jsonToFirestoreFields(value) } };
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function firestoreFieldsToJson(fields) {
  const result = {};
  if (!fields) {
    return result;
  }
  for (const [key, value] of Object.entries(fields)) {
    result[key] = firestoreValueToJson(value);
  }
  return result;
}

function firestoreValueToJson(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  if ("nullValue" in value) {
    return null;
  }
  if ("booleanValue" in value) {
    return value.booleanValue;
  }
  if ("integerValue" in value) {
    return Number(value.integerValue);
  }
  if ("doubleValue" in value) {
    return value.doubleValue;
  }
  if ("stringValue" in value) {
    return value.stringValue;
  }
  if ("timestampValue" in value) {
    return value.timestampValue;
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(firestoreValueToJson);
  }
  if ("mapValue" in value) {
    return firestoreFieldsToJson(value.mapValue.fields);
  }
  return null;
}

// Firestore's setDoc(..., { merge: true }) merges nested maps down to the leaf
// fields, so the REST update mask must list the leaf paths of the update for
// equivalent behaviour (e.g. writing players.playerTwo must not clobber
// players.playerOne).
function computeLeafPaths(value, prefix, out) {
  if (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  ) {
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) {
        continue;
      }
      computeLeafPaths(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  if (prefix) {
    out.push(prefix);
  }
}

// ---------------------------------------------------------------------------
// Firestore REST requests
// ---------------------------------------------------------------------------

async function firestoreFetch(
  path,
  init = {},
  { retriedWithoutAuth = false } = {}
) {
  const headers = { "Content-Type": "application/json" };
  const token = await getIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (
    (response.status === 401 || response.status === 403) &&
    !retriedWithoutAuth
  ) {
    // The anonymous sign-in may have been rejected or the token expired.
    // Retry once without credentials; this succeeds when the project's
    // security rules allow public access.
    cachedToken = null;
    return firestoreFetch(path, init, { retriedWithoutAuth: true });
  }

  return response;
}

async function readErrorDetail(response) {
  try {
    const body = await response.json();
    return (body && body.error && body.error.message) || response.statusText;
  } catch (error) {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function getLobbyDoc(roomCode) {
  const response = await firestoreFetch(
    `/lobbies/${encodeURIComponent(roomCode)}`,
    { method: "GET" }
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Firestore read failed: ${detail}`);
  }
  return response.json();
}

// Writes `data` to the lobby document. With fullReplace the entire document is
// replaced; otherwise only the leaf fields present in `data` are merged in,
// mirroring setDoc(..., { merge: true }).
async function commitLobbyUpdate(roomCode, data, { fullReplace = false } = {}) {
  const documentName = `projects/${PROJECT_ID}/databases/(default)/documents/lobbies/${encodeURIComponent(
    roomCode
  )}`;

  const write = {
    update: {
      name: documentName,
      fields: jsonToFirestoreFields(data),
    },
  };

  if (!fullReplace) {
    const fieldPaths = [];
    computeLeafPaths(data, "", fieldPaths);
    if (fieldPaths.length === 0) {
      throw new Error("Lobby update contained no writable fields.");
    }
    write.updateMask = { fieldPaths };
  }

  const response = await firestoreFetch(":commit", {
    method: "POST",
    body: JSON.stringify({ writes: [write] }),
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`Firestore write failed: ${detail}`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        resolve({});
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = {
  API_KEY,
  PROJECT_ID,
  commitLobbyUpdate,
  computeLeafPaths,
  firestoreFieldsToJson,
  firestoreFetch,
  firestoreValueToJson,
  getLobbyDoc,
  jsonToFirestoreFields,
  readJsonBody,
  sendJson,
};
