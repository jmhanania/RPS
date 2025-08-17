# ---------- Paths ----------
STATS_PATH = "rps_stats.json"
CONFIG_PATH = "rps_config.json"

# ---------- Core ----------
CHOICES = ["rock", "paper", "scissors"]
BEATS   = {"rock": "scissors", "paper": "rock", "scissors": "paper"}  # key beats value

# ---------- AI exploration (per difficulty) ----------
EPSILON_ADAPTIVE = 0.20   # difficulty 2
EPSILON_TRICKY   = 0.25   # difficulty 3
EPSILON_MARKOV   = 0.20   # difficulty 4

# ---------- AI confidence ----------
MIN_SUPPORT = 3           # how many times we need to have seen a transition
MIN_MARGIN  = 0.40        # leader minus runner-up share (0..1)

# ---------- Persisted vs live blending ----------
PERSIST_WEIGHT = 0.50     # trust saved stats this much vs. live match (0..1)

# ---------- Profile defaults ----------
DEFAULT_PLAYER_STATS = {
    "totals": {"rock": 0, "paper": 0, "scissors": 0},
    "order1": {
        "rock": {"rock": 0, "paper": 0, "scissors": 0},
        "paper": {"rock": 0, "paper": 0, "scissors": 0},
        "scissors": {"rock": 0, "paper": 0, "scissors": 0},
    },
    "order2": {}  # e.g., "rock,paper": {"rock": n, "paper": n, "scissors": n}
}

DEFAULT_PLAYER_CONFIG = {"best_of": 5, "difficulty": 4, "debug": False}