# Troubleshooting

Common issues encountered during development and how to fix them.

---

## Google Sign-In: "The requested action is invalid"

**Cause:** One or more Firebase/Google Cloud settings are misconfigured.

Work through these in order:

**1. Missing authorized JavaScript origin**
Go to Google Cloud Console → Google Auth Platform → Clients → your web client.
Under **Authorized JavaScript origins**, add:
- `https://your-domain.github.io`
- `http://localhost:8080` (for local testing)

**2. API key is blocking `firebaseapp.com`**
This is the most common hidden cause. The Firebase auth popup routes through
`https://rps-leaderboard-95043.firebaseapp.com` to process sign-in. If your API
key has HTTP referrer restrictions that don't include that domain, you'll get a
`API_KEY_HTTP_REFERRER_BLOCKED` 403 in the browser console.

Go to Google Cloud Console → APIs & Services → Credentials → your API key.
Either remove referrer restrictions entirely, or add:
- `https://rps-leaderboard-95043.firebaseapp.com/*`

**3. OAuth consent screen in Testing mode**
Go to Google Auth Platform → Audience. If Publishing status is **Testing**,
only explicitly added test users can sign in. Switch to **Production**.

**4. Your domain isn't in Firebase Authorized Domains**
Firebase Console → Authentication → Settings → Authorized Domains.
Add `your-domain.github.io`. (`localhost` is included by default.)

---

## Google Sign-In: popup opens then closes, nothing happens (sign-in loop)

**Cause:** `signInWithRedirect` was used instead of `signInWithPopup`.

The redirect flow routes auth through `firebaseapp.com` via an iframe. Modern
browsers block this cross-domain communication (third-party cookie restrictions),
so the user gets redirected back to the app but the auth state never commits.

**Fix:** Use `signInWithPopup`. If the popup is blocked by the browser, a clear
error is shown; the user can allow popups for the site and try again.

---

## Google Sign-In: clicking the button does nothing

**Cause:** The browser silently blocked the popup.

Look for a blocked-popup indicator in the browser's address bar. Allow popups
for the site. If the code is working correctly, a visible error message should
appear when the popup is blocked — if it doesn't, check the browser console
for `Sign-in failed:` followed by the Firebase error code.

---

## Leaderboard: "Failed to load" error

Two possible causes:

**1. Firestore rules not deployed**
The rules file in the repo isn't live until deployed. After any change to
`firestore.rules` or `functions/index.js`, run:
```bash
firebase deploy --only firestore:rules,functions
```

**2. Collection name mismatch**
The client queries `v2_leaderboard_0` through `v2_leaderboard_4`. If the
Firestore rules reference different collection names (e.g. `leaderboard_0`),
every read is rejected. Confirm the `isLeaderboard()` function in
`firestore.rules` matches the collection names used in `js/game.js`.

---

## GitHub secret scanning alert for the Firebase API key

**This is a false positive.** Firebase's `apiKey` is a public project identifier
by design — it is embedded in client-side code in every Firebase web app and is
not a secret. Firebase security is enforced by Firestore rules and authorized
domains, not by keeping the key private.

**What to do:**
1. Do **not** rotate or revoke the key — that breaks the app.
2. Restrict the key in Google Cloud Console → APIs & Services → Credentials:
   - Application restrictions: HTTP referrers
   - Add your domain(s) **and** `https://rps-leaderboard-95043.firebaseapp.com/*`
   - API restrictions: Identity Toolkit API, Cloud Firestore API
3. Dismiss the GitHub alert as a false positive.

---

## Local development: sign-in works but leaderboard won't load

Leaderboard reads are public but still go through Firestore. Make sure:
- You're serving via a local server (`python3 -m http.server 8080`), not
  opening `index.html` directly as a `file://` URL — Firebase requires HTTP/S.
- `localhost` is in Firebase Authorized Domains (it is by default).
- The Firestore rules have been deployed (`firebase deploy --only firestore:rules`).

---

## Scores not appearing on the leaderboard after a match

Scores are auto-submitted at match end for signed-in users. If they don't appear:
- Confirm you're signed in with a Google account (not playing as a guest).
- Open the browser console and check for Firestore write errors.
- Confirm the Firestore rules allow writes from your UID to `v2_leaderboard_*`.
- Remember the leaderboard fetches up to 100 docs and shows the top 20 — if
  your score isn't in the top 20 by PCT it won't be visible.
