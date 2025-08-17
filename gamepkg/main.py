from .persistence import load_stats, load_config
from .profiles import CURRENT_PLAYER, choose_profile, get_options
from .game import play_match
from .report import print_profile_stats

def post_match_menu() -> str:
    print("\nWhat next?")
    print("  1) Play again")
    print("  2) Show stats")
    print("  3) Switch player")
    print("  4) Change settings")
    print("  5) Quit")
    while True:
        choice = input("Choose 1–5: ").strip()
        if choice in {"1", "2", "3", "4", "5"}:
            return choice
        print("Please enter 1–5.")

def main():
    global CURRENT_PLAYER
    load_stats()
    load_config()

    # Choose / create player and load per-player options
    CURRENT_PLAYER = choose_profile()
    best_of, difficulty, debug = get_options()

    while True:
        # Play a match with current settings
        play_match(best_of, difficulty, debug)

        # Post-match menu loop (allows multiple actions before next match)
        while True:
            action = post_match_menu()

            if action == "2":  # Show stats
                print_profile_stats()
                continue  # stay in the menu

            if action == "3":  # Switch player
                CURRENT_PLAYER = choose_profile()
                best_of, difficulty, debug = get_options()
                continue  # stay in the menu

            if action == "4":  # Change settings
                best_of, difficulty, debug = get_options()
                continue  # stay in the menu

            if action == "1":  # Play again (start next match)
                break

            if action == "5":  # Quit
                print("Thanks for playing! Goodbye 👋")
                return

if __name__ == "__main__":
    main()
