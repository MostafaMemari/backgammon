// GET  /api/lobbies/:id — read the lobby document (used for polling).
// POST /api/lobbies/:id — merge-update fields of the lobby document.
//
// The :id is the 4-letter room code, which doubles as the Firestore document
// ID. POST bodies look like { data: { ...fields } } and are applied with a
// leaf-field update mask, mirroring the previous setDoc(..., { merge: true })
// behaviour.

const {
  commitLobbyUpdate,
  firestoreFieldsToJson,
  getLobbyDoc,
  readJsonBody,
  sendJson,
} = require("../_lib");

module.exports = async (req, res) => {
  const roomCode = String(req.query.id || "").toUpperCase();

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
