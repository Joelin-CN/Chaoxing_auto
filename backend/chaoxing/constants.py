"""
Global constants: paths, locks, and process-wide flags.

These are the foundational constants extracted from utils.py.
All other modules depend on these — constants.py has zero internal dependencies.
"""

import os
import sys
import io
import threading
from pathlib import Path

# ── Force UTF-8 on Windows ────────────────────────────────────
if sys.platform == "win32":
    if sys.stdout.buffer is not None:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    if sys.stderr.buffer is not None:
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

# ── Paths ──────────────────────────────────────────────────────
WORKSPACE = Path(os.environ.get("CHAOXING_WORKSPACE", str(Path(__file__).parent.parent)))
SCRIPT_DIR = WORKSPACE / "scripts"
CONFIG_PATH = WORKSPACE / "chaoxing_config.json"   # Project root (moved out of scripts/)
OUTPUT_DIR = WORKSPACE / "output"       # Runtime output (progress, discovered courses)
TMP_DIR = WORKSPACE / "temp"            # Temporary files (JS scripts, screenshots)

# ── Package data paths (JS injection files, font tables) ─────
PACKAGE_DIR = Path(__file__).parent
JS_DIR = PACKAGE_DIR / "js"
DATA_DIR = PACKAGE_DIR / "data"

# ── Max Concurrent Accounts ────────────────────────────────────
# Limits simultaneous Chrome browser instances. Based on hardware:
# AMD Ryzen 9 8945HX (16C/32T), 32GB RAM, RTX 5070 (~4GB VRAM).
# With --disable-gpu, RAM is the bottleneck: ~400MB per instance.
# Conservative limit of 10 accounts accounts for laptop thermals.
MAX_CONCURRENT_ACCOUNTS = 10
ACCOUNT_SEMAPHORE = threading.BoundedSemaphore(MAX_CONCURRENT_ACCOUNTS)

# ── Graceful Shutdown ──────────────────────────────────────────
# Set by the orchestrator when Ctrl+C is caught. Worker threads
# check this flag at safe yield points and exit cleanly.
SHUTDOWN_FLAG = threading.Event()
