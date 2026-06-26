"""
CLI entry point for listing configured Chaoxing accounts.

Usage::

    python -m chaoxing.accounts

Emits exactly ONE line of JSON to stdout for the frontend to consume:

    success: {"type":"ACCOUNTS","accounts":[{"index":0,"account":"13251303918"}, ...]}
    failure: {"type":"ERROR","error":"<msg>","detail":"<type>"}  + exit code 1

This command is independent of ``chaoxing.api`` — it does NOT touch the job
argparse (--job-id/--accounts/--mode). It reads passwords/chaoxing.txt via the
shared parser and returns each account's index + login id (account string).

SECURITY: passwords are NEVER included in the output — only the account id
(phone/email) and its index. All debug output goes to stderr; stdout is
strictly one JSON line.
"""

import sys
import json

from .platform.auth import read_all_chaoxing_credentials


def _write_json_line(obj: dict) -> None:
    """Write a single compact JSON object as one line to stdout, then flush."""
    line = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def main() -> None:
    """List configured accounts and emit a single JSON line.

    Exits 0 on success (ACCOUNTS), 1 on failure (ERROR).
    """
    try:
        creds = read_all_chaoxing_credentials()
    except Exception as e:
        _write_json_line({
            "type": "ERROR",
            "error": str(e),
            "detail": type(e).__name__,
        })
        sys.exit(1)

    # Strip everything except index + account id. NEVER emit passwords.
    accounts = [
        {"index": c.get("index", i), "account": c.get("account", "")}
        for i, c in enumerate(creds)
    ]

    _write_json_line({"type": "ACCOUNTS", "accounts": accounts})


if __name__ == "__main__":
    main()
