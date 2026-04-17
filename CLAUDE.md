# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Rock Paper Scissors — available as a browser web app and a Python CLI. The web app is the primary product; the Python CLI is a legacy companion.

---

## Web app

### Local development

```bash
# Serve locally (localhost is in Firebase's authorized domains by default)
python3 -m http.server 8080
# then open http://localhost:8080
```

No build step — pure HTML/CSS/JS loaded via CDN. Firebase SDKs are loaded from `https://www.gstatic.com/firebasejs/10.12.0/`.

### File structure

| File | Responsibility |
|------|---------------|
| `index.html` | All screens (profile, settings, game, stats, leaderboard, username modal) |
| `style.css` | Dark purple theme; all layout and component styles |
| `js/game.js` | Game logic, AI, localStorage persistence, leaderboard fetch/render, screen routing |
| `js/auth.js` | Firebase Auth (Google Sign-In popup), username modal, `updateAuthUI()` |
| `firestore.rules` | Firestore security rules — deploy separately (see below) |
| `functions/index.js` | Cloud Function: syncs username changes to all leaderboard collections |
| `firebase.json` | Firebase project config (Hosting, Firestore, Functions) |

### Architecture

**Screens** are `<div class="screen">` elements; only one has `.active` at a time. `show(id)` in `game.js` switches between them.

**Auth flow:**
1. `onAuthStateChanged` in `auth.js` fires on every page load.
2. If signed in → `loadUsername(uid)` reads `users/{uid}` from Firestore. If no username exists yet, shows the username picker modal.
3. `updateAuthUI()` toggles signed-in/signed-out panels and controls visibility of leaderboard buttons and sign-out buttons across all screens.
4. Sign-in uses `signInWithPopup` (Google provider). Popup-blocked errors surface a visible message.
5. Sign-out navigates back to the profile screen via `onAuthStateChanged`.

**Two player paths:**
- **Guest** — enters a name, stats saved to localStorage only, no leaderboard access.
- **Signed-in** — Google account + chosen RPS handle, stats synced to Firestore leaderboard automatically at match end.

**Leaderboard:**
- Firestore collections: `v2_leaderboard_0` (aggregate) through `v2_leaderboard_4` (per AI difficulty).
- Document ID = Firebase UID (prevents impersonation).
- Client fetches up to 100 docs, sorts client-side, displays top 20.
- Score auto-submitted at match end for signed-in users — no manual button.

**localStorage schema:**
```
rps_stats  → { profiles: { [name]: { totals, order1, order2, by_difficulty } } }
rps_config → { profiles: { [name]: { best_of, difficulty, commentary } }, last_profile }
```

**AI difficulty levels (D1–D4):**

| Level | Strategy | Epsilon |
|-------|----------|---------|
| 1 | Pure random | — |
| 2 | Counter player's all-time most common move | 20% |
| 3 | Counter recent-weighted prediction (last-5 window weighted double) | 25% |
| 4 | Markov (order-2 → order-1 → recent-weighted fallback), blending live + persisted stats | 20% |

### Firebase deployment

```bash
# Deploy security rules and Cloud Function (required after rule changes)
firebase deploy --only firestore:rules,functions

# Deploy web app to Firebase Hosting
firebase deploy --only hosting

# Preview channel (test without touching live site)
firebase hosting:channel:deploy <channel-name> --expires 7d
```

The Firebase project is `rps-leaderboard-95043`. Authorized domains for Google Sign-In are managed in Firebase Console → Authentication → Settings → Authorized Domains.

### Security notes

- Only `currentUser.uid` is used from the Google auth object — email and displayName are never accessed or stored.
- Firestore rules block cross-user reads on `/users/{uid}` and validate leaderboard writes (non-negative ints, no email field).
- Leaderboard reads are public (no auth required) — only writes require a matching UID.

---

## Python CLI (legacy)

### Commands

```bash
# Run the game
python run_rps.py

# Lint
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

# Run tests
pytest
pytest tests/test_ai.py
pytest tests/test_ai.py::test_function_name
```

Python 3.10+ required (uses `X | Y` union type hints). No external dependencies (stdlib only).

### Module responsibilities

- `main.py` — Top-level game loop and post-match menu.
- `game.py` — Single-match flow: input, AI, outcomes, stats persistence.
- `ai.py` — All four AI difficulties. `get_computer_choice(difficulty, history)` is the entry point.
- `profiles.py` — Profile selection/creation and per-profile settings.
- `persistence.py` — JSON read/write for `rps_stats.json` and `rps_config.json`.
- `report.py` — Prints totals, order-1 transitions, order-2 patterns.
- `constants.py` — All magic values: file paths, `CHOICES`, `BEATS`, epsilon values, Markov thresholds.

### Conventions

- **Line length:** 127 characters (flake8 enforced).
- **No external packages** — stdlib-only.
- **Silent I/O failures** — `persistence.py` swallows JSON exceptions intentionally.
