import json
import pytest
from unittest.mock import patch

from gamepkg import ai, persistence, profiles
from gamepkg.constants import CHOICES, BEATS, DEFAULT_PLAYER_STATS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def fresh_profile():
    """Reset in-memory state and create a clean test profile before each test."""
    persistence.STATS_WRAPPER  = {"profiles": {}}
    persistence.CONFIG_WRAPPER = {"profiles": {}, "last_profile": None}

    name = "TestPlayer"
    persistence.STATS_WRAPPER["profiles"][name]  = json.loads(json.dumps(DEFAULT_PLAYER_STATS))
    persistence.CONFIG_WRAPPER["profiles"][name] = {"best_of": 5, "difficulty": 4, "debug": False}
    profiles.CURRENT_PLAYER = name


# ---------------------------------------------------------------------------
# get_computer_choice — basic contract
# ---------------------------------------------------------------------------

class TestGetComputerChoiceContract:
    def test_always_returns_valid_move_and_reason(self):
        for difficulty in [1, 2, 3, 4]:
            move, reason = ai.get_computer_choice(difficulty, [])
            assert move in CHOICES
            assert isinstance(reason, str) and reason

    def test_valid_move_with_history_all_difficulties(self):
        history = ["rock", "paper", "scissors", "rock"]
        for difficulty in [1, 2, 3, 4]:
            move, _ = ai.get_computer_choice(difficulty, history)
            assert move in CHOICES


# ---------------------------------------------------------------------------
# D1 — random
# ---------------------------------------------------------------------------

class TestD1Random:
    def test_no_history_returns_valid_choice(self):
        move, _ = ai.get_computer_choice(1, [])
        assert move in CHOICES

    def test_ignores_history(self):
        # D1 should stay random regardless of history pattern
        history = ["rock"] * 20
        move, _ = ai.get_computer_choice(1, history)
        assert move in CHOICES


# ---------------------------------------------------------------------------
# D2 — Adaptive
# ---------------------------------------------------------------------------

class TestD2Adaptive:
    def test_counters_most_common_move(self):
        # Suppress epsilon randomness so deterministic path is taken
        with patch("random.random", return_value=1.0):
            history = ["rock"] * 6 + ["paper"] * 2
            move, reason = ai.get_computer_choice(2, history)
            assert move == "paper"   # paper beats rock
            assert "rock" in reason

    def test_counters_scissors_majority(self):
        with patch("random.random", return_value=1.0):
            history = ["scissors"] * 5 + ["rock"] * 1
            move, _ = ai.get_computer_choice(2, history)
            assert move == "rock"    # rock beats scissors

    def test_epsilon_triggers_random_play(self):
        with patch("random.random", return_value=0.0):
            move, reason = ai.get_computer_choice(2, ["rock"] * 5)
            assert move in CHOICES
            assert "unpredictability" in reason.lower() or "%" in reason


# ---------------------------------------------------------------------------
# D3 — Tricky (recent-weighted)
# ---------------------------------------------------------------------------

class TestD3Tricky:
    def test_returns_valid_choice(self):
        history = ["rock", "paper", "scissors", "rock", "rock"]
        move, _ = ai.get_computer_choice(3, history)
        assert move in CHOICES

    def test_counters_recent_heavy_move(self):
        with patch("random.random", return_value=1.0):
            # Old moves are scissors; last 5 are all rock → predicts rock → plays paper
            history = ["scissors"] * 10 + ["rock"] * 5
            move, _ = ai.get_computer_choice(3, history)
            assert move == "paper"


# ---------------------------------------------------------------------------
# D4 — Markov
# ---------------------------------------------------------------------------

class TestD4Markov:
    def test_returns_valid_choice(self):
        history = ["rock", "paper", "rock", "paper", "rock"]
        move, _ = ai.get_computer_choice(4, history)
        assert move in CHOICES

    def test_uses_order1_pattern_when_confident(self):
        # Seed persisted stats with a very strong order-1 pattern:
        # after "rock", player almost always plays "paper"
        stats = profiles.get_active_stats()
        stats["order1"]["rock"] = {"rock": 0, "paper": 10, "scissors": 0}

        with patch("random.random", return_value=1.0):
            # Last move is rock → should predict paper → counter with scissors
            history = ["scissors", "rock"]
            move, reason = ai.get_computer_choice(4, history)
            assert move == "scissors"
            assert "Order-1" in reason

    def test_falls_back_when_no_pattern(self):
        # No history, no persisted patterns → falls back to recent-weighted or random
        with patch("random.random", return_value=1.0):
            move, _ = ai.get_computer_choice(4, ["rock"])
            assert move in CHOICES


# ---------------------------------------------------------------------------
# recent_weighted_prediction
# ---------------------------------------------------------------------------

class TestRecentWeightedPrediction:
    def test_favors_recent_moves_over_old(self):
        # Many old scissors, but last 5 are all rock → should predict rock
        history = ["scissors"] * 10 + ["rock"] * 5
        predicted, _ = ai.recent_weighted_prediction(history)
        assert predicted == "rock"

    def test_returns_valid_choice_on_single_move(self):
        predicted, reason = ai.recent_weighted_prediction(["paper"])
        assert predicted in CHOICES
        assert isinstance(reason, str)

    def test_empty_history(self):
        predicted, _ = ai.recent_weighted_prediction([])
        assert predicted in CHOICES


# ---------------------------------------------------------------------------
# predict_next_move_markov
# ---------------------------------------------------------------------------

class TestPredictNextMoveMarkov:
    def test_no_history_returns_none(self):
        predicted, _ = ai.predict_next_move_markov([])
        assert predicted is None

    def test_single_move_returns_none(self):
        predicted, _ = ai.predict_next_move_markov(["rock"])
        assert predicted is None

    def test_strong_persisted_order1_detected(self):
        stats = profiles.get_active_stats()
        stats["order1"]["rock"] = {"rock": 0, "paper": 10, "scissors": 0}
        predicted, reason = ai.predict_next_move_markov(["scissors", "rock"])
        assert predicted == "paper"
        assert "Order-1" in reason

    def test_strong_persisted_order2_detected(self):
        stats = profiles.get_active_stats()
        key = "rock,paper"
        stats["order2"][key] = {"rock": 0, "paper": 0, "scissors": 10}
        predicted, reason = ai.predict_next_move_markov(["rock", "paper", "rock", "paper"])
        assert predicted == "scissors"
        assert "Order-2" in reason

    def test_weak_pattern_below_threshold_returns_none(self):
        # Only 1 observation — below MIN_SUPPORT=3
        stats = profiles.get_active_stats()
        stats["order1"]["rock"] = {"rock": 0, "paper": 1, "scissors": 0}
        predicted, _ = ai.predict_next_move_markov(["scissors", "rock"])
        assert predicted is None
