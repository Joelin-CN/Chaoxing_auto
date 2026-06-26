"""
Playwright CLI engine — low-level wrapper around playwright-cli commands.

Provides the core pw() function plus convenience wrappers for snapshot,
click, goto, fill, and run-code. All functions automatically target the
current thread's active session (via _get_active_session).
"""

import os
import sys
import subprocess

from ..constants import WORKSPACE
from ..config import cfg
from ..session import _get_active_session


# ── Argument Quoting ────────────────────────────────────────────

def _quote_arg(arg: str) -> str:
    """Quote an argument for Windows shell if it contains special chars.

    Also collapses newlines to avoid cmd.exe truncating multi-line
    JavaScript/arguments at line breaks.

    Escapes internal double quotes to prevent command injection when
    arguments containing " are wrapped in outer double quotes.
    """
    # Collapse whitespace (including newlines) to prevent cmd.exe splitting
    arg = " ".join(arg.split())
    # Escape internal double quotes for cmd.exe: " → \"
    arg = arg.replace('"', '\\"')
    special = {'&', '?', '=', ' ', '%', '^', '|', '<', '>', '(', ')'}
    if any(c in arg for c in special):
        return f'"{arg}"'
    return arg


def _escape_ps_string(text: str) -> str:
    """Escape a string for safe interpolation into a PowerShell double-quoted string.

    PowerShell special characters inside double-quoted strings:
        $   → variable expansion  → escape with backtick: `$
        `   → escape character    → double it: ``
        "   → string terminator   → double it: ""
        #   → comment (line start) → escape with backtick: `#
        \\n  → not special inside PS double quotes, but newlines must be collapsed
    """
    text = " ".join(text.split())  # collapse whitespace/newlines
    text = text.replace('`', '``')
    text = text.replace('$', '`$')
    text = text.replace('"', '""')
    text = text.replace('#', '`#')
    return text


# ── Core pw() ───────────────────────────────────────────────────

def pw(*args, timeout: int = None, use_shell: bool = False) -> str:
    """Run a playwright-cli command and return stdout.

    Defaults to shell=False for security (avoids cmd.exe injection).
    Pass use_shell=True only for legacy callers that require it.

    All args are quoted properly for Windows shell (cmd.exe).
    URLs with & are wrapped in double quotes to avoid command chaining.
    Multi-line args (e.g. JavaScript) are collapsed to single line.
    """
    session = _get_active_session()
    cli = cfg("playwright_cli", "playwright-cli.cmd")
    t = timeout or cfg("timeouts.snapshot", 15)

    # Headed mode: check CHAOXING_HEADED env var (set by chaoxing_cli.ps1 --headed)
    # Only append --headed for actions that accept it (not snapshot/run-code)
    _headed_actions = {"open", "click", "fill", "press", "goto", "type", "hover", "select-option", "check", "uncheck", "drag"}
    _action = args[0] if args else ""
    _want_headed = os.environ.get("CHAOXING_HEADED", "0") == "1" and _action in _headed_actions
    headed_flag = " --headed" if _want_headed else ""

    if use_shell:
        # Build command string with shell-safe quoting
        quoted = [_quote_arg(a) for a in args]
        cmd_str = f"{cli}{headed_flag} -s={session} " + " ".join(quoted)
        result = subprocess.run(
            cmd_str,
            cwd=str(WORKSPACE),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=t,
            shell=True,
        )
    else:
        # Use list form (shell=False) to avoid pipe buffer deadlock
        # on Windows for long-running commands
        cmd = [cli] + (["--headed"] if headed_flag else []) + [f"-s={session}"] + list(args)
        result = subprocess.run(
            cmd,
            cwd=str(WORKSPACE),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=t,
            shell=False,
        )

    if result.returncode != 0 and result.stderr:
        print(f"[pw] Warning: {result.stderr[:200]}", file=sys.stderr)
    return result.stdout


# ── Convenience Wrappers ────────────────────────────────────────

def pw_snapshot() -> str:
    """Take a boxed snapshot and return YAML text."""
    return pw("snapshot", "--boxes")


def pw_click(ref: str):
    """Click an element by snapshot ref."""
    return pw("click", ref, timeout=cfg("timeouts.click_action", 10))


def pw_goto(url: str):
    """Navigate to a URL.

    Uses _run_js_file for navigation to avoid cmd.exe shell escaping
    issues with & in query parameters (even with shell=False, .cmd
    wrappers go through cmd.exe which interprets & as command separator).
    """
    # Deferred import to break circular dependency with js_runner
    from .js_runner import _run_js_file
    import json as _json

    safe_url = _json.dumps(url)  # JSON-encoded -> safe for JS string literal
    js = f"async (page) => {{ await page.goto({safe_url}); return 'ok'; }}"
    _run_js_file(js, timeout=cfg("timeouts.page_load", 30))


def pw_fill(ref: str, text: str):
    """Fill a textbox by ref (uses clipboard to avoid echo).

    Text is PowerShell-escaped to prevent command injection.
    Clipboard is cleared after paste to prevent credential lingering.
    """
    import subprocess as sp
    session = _get_active_session()
    cli = cfg("playwright_cli", "playwright-cli.cmd")
    safe_text = _escape_ps_string(text)
    ps_cmd = (
        f'$null = Set-Clipboard "{safe_text}"; '
        f'{cli} -s={session} click {ref}; '
        f'{cli} -s={session} press Control+V; '
        f'Start-Sleep -Milliseconds 200; '
        f'$null = Set-Clipboard ""'
    )
    sp.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
        cwd=str(WORKSPACE), capture_output=True, text=True, timeout=30
    )


def pw_run_code(js_code: str) -> str:
    """Execute JS in the page context via run-code.

    Multi-line JS is routed through the temp-file path (_run_js_file): the
    shell=False command line is NOT whitespace-collapsed, so on Windows the
    .cmd wrapper truncates the invocation at the first newline, handing
    playwright-cli a broken arrow function ("SyntaxError: Unexpected token
    ')'"). Single-line JS goes direct. This makes every caller newline-safe
    without each having to remember the tempfile dance.
    """
    if "\n" in js_code:
        # Deferred import: js_runner imports from engine, so importing it at
        # module load would be circular. extract=False keeps the raw-output
        # contract identical to the single-line branch below.
        from .js_runner import _run_js_file
        return _run_js_file(js_code, timeout=20, extract=False)
    return pw("run-code", js_code, timeout=20)
