const { setGlobalOptions }    = require("firebase-functions");
const { onDocumentUpdated }   = require("firebase-functions/v2/firestore");
const { initializeApp }       = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");

setGlobalOptions({ maxInstances: 10 });

initializeApp();

exports.syncUsernameToLeaderboard = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  if (!after.username || before.username === after.username) return null;

  const db       = getFirestore();
  const userId   = event.params.userId;
  const newName  = after.username;

  const batch = db.batch();
  for (let i = 0; i <= 4; i++) {
    const ref = db.collection(`leaderboard_${i}`).doc(userId);
    batch.set(ref, { name: newName }, { merge: true });
  }

  return batch.commit();
});
