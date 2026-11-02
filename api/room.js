// GET  /api/room?code=ABCD — read the lobby document (used for polling).
// POST /api/room?code=ABCD — merge-update fields of the lobby document.
//
// Room creation lives in /api/lobbies (POST). This endpoint deliberately uses
// a plain static path + query parameter instead of a dynamic [id] segment:
// plain paths are the most robust thing on Vercel's routing layer and need no
// dynamic-route support to work.
//
// POST bodies look like { data: { ...fields } } and are applied with a
// leaf-field update mask, mirroring setDoc(..., { merge: true }).

const {
  commitLobbyUpdate,
  firestoreFieldsToJson,
  getLobbyDoc,
  readJsonBody,
  sendJson,
} = require("./_lib");

module.exports = async (req, res) => {
  const roomCode = String((req.query && req.query.code) || "").toUpperCase();

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    sendJson(res, 400, { error: "Invalid room code" });
    return;
  }

  try {
    if (req.method === "GET") {
      const doc = await getLobbyDoc(roomCode);
      if (!doc) {
        sendJson(res, 404, { found: false, roomCode });
        return;
      }
      sendJson(res, 200, {
        found: true,
        roomCode,
        data: firestoreFieldsToJson(doc.fields),
        updateTime: doc.updateTime || null,
      });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const data = body.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJson(res, 400, { error: "Missing lobby data" });
        return;
      }
      await commitLobbyUpdate(roomCode, data, { fullReplace: false });
      sendJson(res, 200, { ok: true, roomCode });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 502, {
      error: "Lobby request failed",
      detail: String((error && error.message) || error),
    });
  }
};
