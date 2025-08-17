from .constants import CHOICES
from .profiles import get_active_stats, CURRENT_PLAYER

def _pct(n: int, d: int) -> str:
    return "0.0%" if d <= 0 else f"{(100.0 * n / d):.1f}%"

def _row(total: int, counts: dict[str, int]) -> str:
    # counts order: rock, paper, scissors
    return " | ".join(f"{counts[m]:>3} ({_pct(counts[m], total):>6})" for m in CHOICES)

def print_profile_stats() -> None:
    """Pretty-prints the active player's persisted stats."""
    stats = get_active_stats()
    print(f"\n=== Stats for {CURRENT_PLAYER} ===")

    # Totals
    totals = stats.get("totals", {})
    total_moves = sum(totals.get(m, 0) for m in CHOICES)
    print("\nTotal moves:")
    for m in CHOICES:
        print(f"  {m:<9}: {totals.get(m,0):>4}   ({_pct(totals.get(m,0), total_moves)})")
    print(f"  {'all':<9}: {total_moves:>4}\n")

    # Order-1 transition matrix
    o1 = stats.get("order1", {})
    print("Order-1 transitions (what you play next):")
    header = "prev → next     |  rock (%)    |  paper (%)   |  scissors (%)"
    print(header)
    print("-" * len(header))
    for prev in CHOICES:
        row = o1.get(prev, {})
        row_total = sum(row.get(m, 0) for m in CHOICES)
        print(f"{prev:<14}| {_row(row_total, row)}")
    print()

    # For each prev, show the most likely next
    print("Most likely next after each move:")
    for prev in CHOICES:
        row = o1.get(prev, {})
        if not row:
            print(f"  after {prev:<8}: (no data)")
            continue
        best = max(CHOICES, key=lambda m: row.get(m, 0))
        ct = row.get(best, 0)
        tot = sum(row.values())
        print(f"  after {prev:<8}: {best}  ({ct}/{tot}, {_pct(ct, tot)})")
    print()

    # Order-2: show top 5 most common states
    o2 = stats.get("order2", {})
    if o2:
        # sort by total transitions seen for that pair
        ranked = sorted(
            o2.items(),
            key=lambda kv: sum(kv[1].get(m, 0) for m in CHOICES),
            reverse=True
        )[:5]
        print("Top order-2 states (prev two → likely next):")
        for key, dist in ranked:
            total = sum(dist.get(m, 0) for m in CHOICES)
            best = max(CHOICES, key=lambda m: dist.get(m, 0)) if total > 0 else None
            a, b = key.split(",")
            parts = ", ".join(f"{m}:{dist.get(m,0)}({_pct(dist.get(m,0), total)})" for m in CHOICES)
            if best:
                print(f"  ({a}, {b}) → {best}   [{total} obs]   [{parts}]")
            else:
                print(f"  ({a}, {b}) → (no data)")
    else:
        print("No order-2 data yet.")
    print()
