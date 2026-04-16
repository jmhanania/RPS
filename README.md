# Rock Paper Scissors

A Rock Paper Scissors game with multiple AI difficulty levels, player profiles, and persistent stats. Available as both a browser-based web app and a Python CLI.

## Web App

Open `index.html` in any browser — no server, no install required.

**Features:**
- Four AI difficulty levels: Random, Adaptive, Tricky, and Markov (learns your patterns across sessions)
- Multiple player profiles with stats saved in your browser
- Match lengths: Best of 3 / 5 / 7 / 9, or Infinite
- AI commentary modes: Off, Analysis (see the AI's reasoning), or Trash Talk 🔥
- Stats screen showing move frequency and transition patterns

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

## Development

```bash
# Run tests
pytest

# Lint
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
```
