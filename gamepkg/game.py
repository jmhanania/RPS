from .constants import CHOICES
from .ai import get_computer_choice
from .profiles import get_active_stats
from .persistence import save_stats

def get_player_choice() -> str:
    while True:
        choice = input("Choose rock, paper, or scissors: ").strip().lower()
        if choice in CHOICES:
            return choice
        print("Invalid choice. Type rock, paper, or scissors.")

def round_outcome(player: str, computer: str) -> str:
    if player == computer:
        return "tie"
    wins = {("rock", "scissors"), ("paper", "rock"), ("scissors", "paper")}
    return "player" if (player, computer) in wins else "computer"

def update_stats_from_history(history: list[str]) -> None:
    stats = get_active_stats()
    for m in history:
        stats["totals"][m] = stats["totals"].get(m, 0) + 1
    for a, b in zip(history, history[1:]):
        stats["order1"][a][b] = stats["order1"][a].get(b, 0) + 1
    for a, b, c in zip(history, history[1:], history[2:]):
        key = f"{a},{b}"
        if key not in stats["order2"]:
            stats["order2"][key] = {"rock": 0, "paper": 0, "scissors": 0}
        stats["order2"][key][c] = stats["order2"][key].get(c, 0) + 1

def play_match(best_of: int, difficulty: int, debug: bool) -> None:
    wins_needed = best_of // 2 + 1
    player_score = 0
    computer_score = 0
    round_num = 1
    history: list[str] = []

    print(f"\nWelcome to Rock–Paper–Scissors! Best of {best_of}. First to {wins_needed} wins.\n")

    while player_score < wins_needed and computer_score < wins_needed:
        print(f"Round {round_num}:")
        player = get_player_choice()
        history.append(player)

        computer, reason = get_computer_choice(difficulty, history)
        print(f"Computer chose: {computer}")
        if debug:
            print(f"[AI] {reason}")

        result = round_outcome(player, computer)
        if result == "tie":
            print("It's a tie.")
        elif result == "player":
            print("You win this round!")
            player_score += 1
        else:
            print("Computer wins this round!")
            computer_score += 1

        print(f"Score → You: {player_score}, Computer: {computer_score}\n")
        round_num += 1

    print("🎉 You are the champion!" if player_score > computer_score else "💻 Computer is the champion!")

    if history:
        r = history.count("rock"); p = history.count("paper"); s = history.count("scissors")
        total = len(history)
        print(f"Your tendencies this match → rock: {r}/{total}, paper: {p}/{total}, scissors: {s}/{total}")

    # Persist learning across matches
    update_stats_from_history(history)
    save_stats()
