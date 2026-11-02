// POST /api/lobbies — create a new lobby document in Firestore.
//
// The lobby document ID is the 4-letter room code, so lookups are direct
// document reads (no queries, no composite indexes). If the code is already
// taken by a recent lobby the endpoint responds with 409 and the client
// retries with a different code.

const {
  commitLobbyUpdate,
  getLobbyDoc,
  readJsonBody,
  sendJson,
} = require("./_lib");

const LOBBY_EXPIRY_MS = 6 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = await readJsonBody(req);
  const roomCode = String(body.roomCode || "").toUpperCase();
  const data = body.data;

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    sendJson(res, 400, { error: "Invalid room code" });
    return;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    sendJson(res, 400, { error: "Missing lobby data" });
    return;
  }

  try {
    const existing = await getLobbyDoc(roomCode);
    if (existing && existing.createTime) {
      const createdMs = Date.parse(existing.createTime);
      if (!Number.isNaN(createdMs) && Date.now() - createdMs < LOBBY_EXPIRY_MS) {
        sendJson(res, 409, {
          error: "Room code already in use",
          roomCode,
        });
        return;
      }
    }

    // The server clock is the single source of truth for creation time so
    // that expiry checks are consistent for every client.
    data.timeCreated = new Date().toISOString();

    await commitLobbyUpdate(roomCode, data, { fullReplace: true });

    sendJson(res, 200, { ok: true, roomCode });
  } catch (error) {
    sendJson(res, 502, {
      error: "Failed to create room",
      detail: String((error && error.message) || error),
    });
  }
};
