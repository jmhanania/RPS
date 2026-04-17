// ============================================================
// Firebase Authentication — Google Sign-In + RPS Handle
// ============================================================

var currentUser     = null;   // Firebase Auth user (accessible from game.js)
var currentUsername = null;   // Chosen RPS handle (accessible from game.js)

(function () {
  var provider = new firebase.auth.GoogleAuthProvider();

  // ── Auth state ────────────────────────────────────────────
  firebase.auth().onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      loadUsername(user.uid);
    } else {
      currentUsername = null;
      updateAuthUI();
      // Navigate to profile screen on sign-out
      document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
      var ps = document.getElementById('screen-profile');
      if (ps) ps.classList.add('active');
      var gi = document.getElementById('guest-name');
      if (gi) gi.value = '';
    }
  });

  function loadUsername(uid) {
    firebase.firestore().collection('users').doc(uid).get()
      .then(function (doc) {
        if (doc.exists && doc.data().username) {
          currentUsername = doc.data().username;
          updateAuthUI();
          if (window.goToSettings) window.goToSettings(currentUsername);
        } else {
          showUsernameModal();
        }
      })
      .catch(function () {
        // Firestore unavailable — fall back gracefully, no username
        updateAuthUI();
      });
  }

  // ── Sign-in / Sign-out ────────────────────────────────────
  window.signIn = function () {
    var errorEl = document.getElementById('auth-signin-error');
    if (errorEl) errorEl.textContent = '';
    firebase.auth().signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked') {
        if (errorEl) errorEl.textContent = 'Popup blocked — please allow popups for this site and try again.';
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        if (errorEl) errorEl.textContent = 'Sign-in failed — please try again.';
        console.warn('Sign-in failed:', err.code);
      }
    });
  };

  window.signOut = function () {
    firebase.auth().signOut();
  };

  // ── Username modal ────────────────────────────────────────
  function showUsernameModal() {
    var modal = document.getElementById('modal-username');
    var input = document.getElementById('username-input');
    if (!modal) return;
    document.getElementById('username-error').textContent = '';
    document.getElementById('btn-username-submit').disabled   = false;
    document.getElementById('btn-username-submit').textContent = "Let's Play";
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(function () { input.focus(); }, 50);
  }

  window.changeUsername = showUsernameModal;

  window.submitUsername = function () {
    var input     = document.getElementById('username-input');
    var errorEl   = document.getElementById('username-error');
    var submitBtn = document.getElementById('btn-username-submit');
    var handle    = input.value.trim();

    if (handle.length < 2 || handle.length > 24) {
      errorEl.textContent = 'Handle must be 2–24 characters.';
      return;
    }

    errorEl.textContent   = '';
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Saving…';

    var db          = firebase.firestore();
    var newKey      = handle.toLowerCase();
    var oldKey      = currentUsername ? currentUsername.toLowerCase() : null;
    var usernameRef = db.collection('usernames').doc(newKey);
    var userRef     = db.collection('users').doc(currentUser.uid);

    db.runTransaction(function (tx) {
      return tx.get(usernameRef).then(function (doc) {
        if (doc.exists && doc.data().uid !== currentUser.uid) {
          return Promise.reject('taken');
        }
        if (oldKey && oldKey !== newKey) {
          tx.delete(db.collection('usernames').doc(oldKey));
        }
        tx.set(usernameRef, { uid: currentUser.uid });
        tx.set(userRef, { username: handle });
      });
    })
      .then(function () {
        currentUsername = handle;
        document.getElementById('modal-username').style.display = 'none';
        updateAuthUI();
        if (window.goToSettings) window.goToSettings(currentUsername);
      })
      .catch(function (err) {
        errorEl.textContent   = err === 'taken'
          ? 'That handle is already taken — try another.'
          : 'Could not save — please try again.';
        submitBtn.disabled    = false;
        submitBtn.textContent = "Let's Play";
      });
  };

  // ── UI sync ───────────────────────────────────────────────
  function updateAuthUI() {
    var signedIn    = !!currentUser;
    var hasHandle   = signedIn && !!currentUsername;

    // Profile screen — toggle signed-in / signed-out panels
    setDisplay('auth-signed-in',  hasHandle ? ''     : 'none');
    setDisplay('auth-signed-out', hasHandle ? 'none' : '');
    setText('auth-handle-display', currentUsername || '');

    // Settings screen
    setDisplay('btn-change-username',  hasHandle ? '' : 'none');
    setDisplay('btn-settings-signout', signedIn  ? '' : 'none');

    // Guest sign-in prompt on settings screen
    setDisplay('settings-signin-prompt',   signedIn  ? 'none' : '');

    // Leaderboard + sign-out on other screens (guests can't access leaderboard)
    setDisplay('btn-settings-leaderboard', hasHandle ? '' : 'none');
    setDisplay('mop-leaderboard',          hasHandle ? '' : 'none');
    setDisplay('mop-signout',              signedIn  ? '' : 'none');
    setDisplay('btn-stats-signout',        signedIn  ? '' : 'none');
    setDisplay('btn-lb-signout',           signedIn  ? '' : 'none');
  }

  function setDisplay(id, val) {
    var el = document.getElementById(id);
    if (el) el.style.display = val;
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }
})();
