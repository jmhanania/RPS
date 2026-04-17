// ============================================================
// Firebase Authentication — Google Sign-In + RPS Handle
// ============================================================

var currentUser     = null;   // Firebase Auth user (accessible from game.js)
var currentUsername = null;   // Chosen RPS handle (accessible from game.js)

(function () {
  var provider = new firebase.auth.GoogleAuthProvider();

  // ── Pick up redirect result (no-op if no redirect pending) ───
  firebase.auth().getRedirectResult().catch(function (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      var el = document.getElementById('auth-signin-error');
      if (el) el.textContent = 'Sign-in failed — please try again.';
      console.warn('Sign-in failed:', err.code);
    }
  });

  // ── Auth state ────────────────────────────────────────────
  firebase.auth().onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      loadUsername(user.uid);
    } else {
      currentUsername = null;
      updateAuthUI();
    }
  });

  function loadUsername(uid) {
    firebase.firestore().collection('users').doc(uid).get()
      .then(function (doc) {
        if (doc.exists && doc.data().username) {
          currentUsername = doc.data().username;
          updateAuthUI();
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
    var el = document.getElementById('auth-signin-error');
    if (el) el.textContent = '';
    firebase.auth().signInWithRedirect(provider);
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

    errorEl.textContent       = '';
    submitBtn.disabled        = true;
    submitBtn.textContent     = 'Saving…';

    firebase.firestore().collection('users').doc(currentUser.uid).set({ username: handle })
      .then(function () {
        currentUsername = handle;
        document.getElementById('modal-username').style.display = 'none';
        updateAuthUI();
      })
      .catch(function () {
        errorEl.textContent   = 'Could not save — please try again.';
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
    setDisplay('btn-change-username', hasHandle ? '' : 'none');

    // Leaderboard buttons — guests cannot submit, so hide entry points
    setDisplay('btn-settings-leaderboard', hasHandle ? '' : 'none');
    setDisplay('mop-leaderboard',          hasHandle ? '' : 'none');

    // Match-over panel
    setDisplay('mop-sign-in',  signedIn ? 'none' : '');
    setDisplay('mop-sign-out', signedIn ? ''     : 'none');
    setText('mop-auth-name', currentUsername || '');

    var submitBtn = document.getElementById('mop-submit-score');
    if (submitBtn && submitBtn.dataset.submitted !== 'true') {
      submitBtn.disabled = !hasHandle;
    }
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
