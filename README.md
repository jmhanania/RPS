# Rock Paper Scissors

A Rock Paper Scissors game with four AI difficulty levels, a global leaderboard, and persistent stats. Available as a browser web app and a Python CLI.

## Web App

### Playing

- **Guest** — enter a name and play immediately. Stats are saved in your browser only.
- **Signed in** — sign in with Google, pick an RPS handle, and your scores appear on the global leaderboard automatically after each match.

### Features

- Four AI difficulty levels: Random, Adaptive, Tricky, and Markov (learns your move patterns)
- Match lengths: Best of 3 / 5 / 7 / 9, or Infinite
- AI commentary modes: Off, Analysis (see the AI's reasoning), or Trash Talk 🔥
- Stats screen: move frequency, win rate by difficulty, and transition patterns
- Global leaderboard with per-difficulty tabs, sortable columns, and baseball-style PCT rating
- Google Sign-In — only your chosen username appears publicly, never your email or real name

### Local development

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Firebase requires a server (not `file://`). `localhost` is pre-authorized for Google Sign-In.

### Firebase deployment

```bash
# After changing firestore.rules or functions/index.js
firebase deploy --only firestore:rules,functions

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Test on a preview URL without touching the live site
firebase hosting:channel:deploy preview --expires 7d
```

## Python CLI

```bash
python run_rps.py
```

Requires Python 3.10+. No external dependencies.

## AI Difficulty Levels

| Level | Strategy |
|-------|----------|
| 1 – Random | Pure random |
| 2 – Adaptive | Counters your most common move (20% randomness) |
| 3 – Tricky | Weights your recent moves more heavily (25% randomness) |
| 4 – Markov | Learns your move sequences using order-1 and order-2 Markov chains, blending live and historical stats (20% randomness) |

## Development (Python CLI)

```bash
# Run tests
pytest

# Lint
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
```
