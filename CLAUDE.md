# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the game
python run_rps.py

# Lint (matches CI configuration)
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

# Run tests
pytest

# Run a single test file
pytest tests/test_ai.py

# Run a single test
pytest tests/test_ai.py::test_function_name
```

No build step — pure Python, no external dependencies (stdlib only). Python 3.10+ required (uses `X | Y` union type hints).

## Architecture

The game lives entirely in `gamepkg/`. The entry point `run_rps.py` just calls `gamepkg.main.main()`.

**Module responsibilities:**

- `main.py` — Top-level game loop and post-match menu. Orchestrates profile selection, option loading, match play, and the action menu (play again / show stats / switch player / change settings / quit).
- `game.py` — Single-match flow: collects player input each round, calls AI, resolves outcomes, accumulates per-match history, and persists stats at match end.
- `ai.py` — All four AI difficulties. `get_computer_choice(difficulty, history)` is the main entry point; `history` is a list of the player's moves in the current match.
- `profiles.py` — Profile selection/creation and per-profile settings (`best_of`, `difficulty`, `debug`). Manages the `CURRENT_PLAYER` module-level global.
- `persistence.py` — JSON read/write for `rps_stats.json` and `rps_config.json`. Holds module-level `STATS_WRAPPER` and `CONFIG_WRAPPER` dicts as in-memory state. Includes silent schema migration from legacy single-player format.
- `report.py` — Reads from `STATS_WRAPPER` to print totals, order-1 transitions, and order-2 patterns.
- `constants.py` — All magic values: file paths, `CHOICES`, `BEATS` map, epsilon values per difficulty, Markov thresholds (`MIN_SUPPORT`, `MIN_MARGIN`), and `PERSIST_WEIGHT`.

**State model:**

Stats and config are loaded once at startup into module-level globals in `persistence.py`. All modules access them via `profiles.py` helpers (`get_active_stats`, `get_active_config`). Stats are written back to disk at the end of each match.

**AI difficulty levels (D1–D4):**

| Level | Strategy | Epsilon |
|-------|----------|---------|
| 1 | Pure random | — |
| 2 | Counter player's all-time most common move | 20% |
| 3 | Counter recent-weighted prediction (last-5 window weighted double) | 25% |
| 4 | Markov (order-2 → order-1 → recent-weighted fallback), blending live + persisted stats | 20% |

D4 blends live match counts with saved historical stats at a 1 : `PERSIST_WEIGHT` (1 : 0.5) ratio. A Markov prediction is only used if it meets `MIN_SUPPORT=3` observations and `MIN_MARGIN=0.40` margin over the next-best option.

## Conventions

- **Line length:** 127 characters (flake8 enforced).
- **No external packages** — keep the stdlib-only constraint.
- **Silent I/O failures** — `persistence.py` swallows all JSON exceptions with `pass`; this is intentional.
- **Stats schema:** Each profile's stats dict has keys `totals` (move counts), `order1` (transition counts keyed by last move), and `order2` (keyed by `"move1,move2"` strings).
