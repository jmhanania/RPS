from collections import defaultdict
from .constants import (
    CHOICES, BEATS,
    EPSILON_ADAPTIVE, EPSILON_TRICKY, EPSILON_MARKOV,
    MIN_SUPPORT, MIN_MARGIN, PERSIST_WEIGHT
)
from .profiles import get_active_stats

def counter_of(move: str) -> str:
    for k, v in BEATS.items():
        if v == move:
            return k
    raise ValueError(f"Unknown move: {move}")

def _top_with_support(counts: dict[str, float]) -> tuple[str | None, float, float, float]:
    if not counts:
        return None, 0.0, 0.0, 0.0
    items = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    top_move, top_ct = items[0]
    next_ct = items[1][1] if len(items) > 1 else 0.0
    total = sum(counts.values())
    margin = (top_ct - next_ct) / total if total > 0 else 0.0
    return top_move, top_ct, next_ct, margin

def recent_weighted_prediction(history: list[str], window: int = 5) -> tuple[str, str]:
    weights = {m: 0.0 for m in CHOICES}
    for m in history:
        weights[m] += 1.0
    for m in history[-window:]:
        weights[m] += 1.0
    predicted = max(weights, key=weights.get)
    reason = f"recent-weighted prediction: {predicted} (last {min(window, len(history))} moves weighted)."
    return predicted, reason

def predict_next_move_markov(history: list[str]) -> tuple[str | None, str]:
    stats = get_active_stats()
    n = len(history)

    def _combine(live: dict[str,int], persist: dict[str,int]) -> dict[str,float]:
        out = {m: 0.0 for m in CHOICES}
        for m in CHOICES:
            out[m] = live.get(m, 0) + PERSIST_WEIGHT * persist.get(m, 0)
        return out

    # Order-2
    if n >= 3:
        counts2_live = defaultdict(int)
        last2 = tuple(history[-2:])
        for i in range(n - 2):
            if tuple(history[i:i+2]) == last2:
                counts2_live[history[i+2]] += 1
        key = f"{last2[0]},{last2[1]}"
        counts2_persist = stats["order2"].get(key, {"rock":0,"paper":0,"scissors":0})
        counts2 = _combine(counts2_live, counts2_persist)

        top, top_ct, _, margin = _top_with_support(counts2)
        if top and top_ct >= MIN_SUPPORT and margin >= MIN_MARGIN:
            return top, f"Order-2 Markov (support={top_ct:.0f}, margin={margin:.2f}) after {last2}."

    # Order-1
    if n >= 2:
        counts1_live = defaultdict(int)
        last1 = history[-1]
        for i in range(n - 1):
            if history[i] == last1:
                counts1_live[history[i+1]] += 1
        counts1_persist = stats["order1"].get(last1, {"rock":0,"paper":0,"scissors":0})
        counts1 = _combine(counts1_live, counts1_persist)

        top, top_ct, _, margin = _top_with_support(counts1)
        if top and top_ct >= MIN_SUPPORT and margin >= MIN_MARGIN:
            return top, f"Order-1 Markov (support={top_ct:.0f}, margin={margin:.2f}) after {last1}."

    return None, "No confident Markov pattern."

def get_computer_choice(difficulty: int, history: list[str]) -> tuple[str, str]:
    import random

    # D1: random
    if difficulty == 1 or not history:
        choice = random.choice(CHOICES)
        return choice, "Random pick (or no history yet)."

    # D2: Adaptive
    if difficulty == 2:
        if random.random() < EPSILON_ADAPTIVE:
            choice = random.choice(CHOICES)
            return choice, f"{int(EPSILON_ADAPTIVE*100)}% unpredictability (Adaptive mode)."
        counts = {m: history.count(m) for m in CHOICES}
        most_common = max(counts, key=counts.get)
        return counter_of(most_common), f"Countering your most common move so far: {most_common}."

    # D3: Recent-weighted
    if difficulty == 3:
        if random.random() < EPSILON_TRICKY:
            choice = random.choice(CHOICES)
            return choice, f"{int(EPSILON_TRICKY*100)}% unpredictability (Tricky mode)."
        predicted, why = recent_weighted_prediction(history, window=5)
        return counter_of(predicted), f"Predicting you’ll throw {predicted} ({why}); I picked its counter."

    # D4: Markov + fallback
    if difficulty == 4:
        if random.random() < EPSILON_MARKOV:
            choice = random.choice(CHOICES)
            return choice, f"{int(EPSILON_MARKOV*100)}% unpredictability (Markov mode)."
        predicted, why = predict_next_move_markov(history)
        if predicted is None:
            predicted, why2 = recent_weighted_prediction(history, window=5)
            return counter_of(predicted), f"{why} Falling back to {why2}"
        return counter_of(predicted), f"{why} I played its counter."

    # Fallback
    choice = random.choice(CHOICES)
    return choice, "Fallback random (unknown difficulty)."
