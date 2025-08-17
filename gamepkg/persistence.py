import json, os
from .constants import STATS_PATH, CONFIG_PATH

# Multi-profile wrappers
STATS_WRAPPER  = {"profiles": {}}                   # name -> stats dict
CONFIG_WRAPPER = {"profiles": {}, "last_profile": None}  # name -> config dict

def load_stats(path: str = STATS_PATH):
    global STATS_WRAPPER
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "profiles" not in data:  # migrate legacy single-player schema
                STATS_WRAPPER = {"profiles": {"Default": data}}
            else:
                STATS_WRAPPER = data
        except Exception:
            STATS_WRAPPER = {"profiles": {}}
    else:
        STATS_WRAPPER = {"profiles": {}}

def save_stats(path: str = STATS_PATH):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(STATS_WRAPPER, f, indent=2)
    except Exception:
        pass  # non-fatal

def load_config(path: str = CONFIG_PATH):
    global CONFIG_WRAPPER
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "profiles" not in data:  # migrate legacy single-player schema
                CONFIG_WRAPPER = {"profiles": {"Default": data}, "last_profile": "Default"}
            else:
                data.setdefault("profiles", {})
                data.setdefault("last_profile", None)
                CONFIG_WRAPPER = data
        except Exception:
            CONFIG_WRAPPER = {"profiles": {}, "last_profile": None}
    else:
        CONFIG_WRAPPER = {"profiles": {}, "last_profile": None}

def save_config(path: str = CONFIG_PATH):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(CONFIG_WRAPPER, f, indent=2)
    except Exception:
        pass  # non-fatal
