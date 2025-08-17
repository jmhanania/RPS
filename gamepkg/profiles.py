import json
from .persistence import STATS_WRAPPER, CONFIG_WRAPPER, save_config
from .constants import DEFAULT_PLAYER_STATS, DEFAULT_PLAYER_CONFIG

CURRENT_PLAYER = None  # set via choose_profile()

def _deepcopy_stats_template():
    # Deep-copy to avoid shared nested dicts
    return json.loads(json.dumps(DEFAULT_PLAYER_STATS))

def _ensure_player_stats(name: str) -> dict:
    STATS_WRAPPER["profiles"].setdefault(name, _deepcopy_stats_template())
    return STATS_WRAPPER["profiles"][name]

def _ensure_player_config(name: str) -> dict:
    CONFIG_WRAPPER["profiles"].setdefault(name, DEFAULT_PLAYER_CONFIG.copy())
    return CONFIG_WRAPPER["profiles"][name]

def get_active_stats() -> dict:
    return _ensure_player_stats(CURRENT_PLAYER)

def get_active_config() -> dict:
    return _ensure_player_config(CURRENT_PLAYER)

def ask_yes_no(prompt: str) -> bool:
    while True:
        ans = input(prompt).strip().lower()
        if ans in {"y","yes"}: return True
        if ans in {"n","no"}:  return False
        print("Please type yes or no.")

def choose_profile() -> str:
    profiles = sorted(set(CONFIG_WRAPPER["profiles"].keys()) | set(STATS_WRAPPER["profiles"].keys()))
    default = CONFIG_WRAPPER.get("last_profile") or (profiles[0] if profiles else "Default")

    print("\n=== Player Profiles ===")
    if profiles:
        for i, name in enumerate(profiles, 1):
            marker = " (last)" if name == CONFIG_WRAPPER.get("last_profile") else ""
            print(f"  {i}) {name}{marker}")
    else:
        print("  <none yet>")

    raw = input(f"Type a profile name to use/create [{default}]: ").strip()
    name = raw if raw else default
    if not name:
        name = "Default"

    _ensure_player_stats(name)
    _ensure_player_config(name)
    CONFIG_WRAPPER["last_profile"] = name
    save_config()
    return name

def choose_options_interactive(cfg: dict) -> dict:
    # best_of
    while True:
        try:
            n = int(input(f"How many rounds? Choose an odd number (e.g., 3, 5, 7) [{cfg['best_of']}]: ") or cfg["best_of"])
            if n > 0 and n % 2 == 1:
                cfg["best_of"] = n
                break
            print("Please enter a positive odd number.")
        except ValueError:
            print("Please enter a whole number.")

    # difficulty
    while True:
        print("Choose difficulty:")
        print("  1) Random")
        print("  2) Adaptive")
        print("  3) Tricky (recent-weighted)")
        print("  4) Predictive (Markov)")
        raw = input(f"Enter 1, 2, 3, or 4 [{cfg['difficulty']}]: ").strip() or str(cfg["difficulty"])
        if raw in {"1","2","3","4"}:
            cfg["difficulty"] = int(raw)
            break
        print("Please enter 1, 2, 3, or 4.")

    # debug
    cfg["debug"] = ask_yes_no(f"Show AI reasoning each round? (yes/no) [{'yes' if cfg['debug'] else 'no'}]: ")
    return cfg

def get_options() -> tuple[int,int,bool]:
    cfg = get_active_config()
    print(f"\n{CURRENT_PLAYER}'s settings → best_of={cfg['best_of']}, difficulty={cfg['difficulty']}, debug={'on' if cfg['debug'] else 'off'}")
    if ask_yes_no("Use these settings? (yes/no): "):
        return cfg["best_of"], cfg["difficulty"], cfg["debug"]
    cfg = choose_options_interactive(cfg)
    save_config()
    print("Settings saved.\n")
    return cfg["best_of"], cfg["difficulty"], cfg["debug"]
