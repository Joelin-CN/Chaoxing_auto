"""
CLI entry point for Volcano Engine account balance query.

Usage::

    python -m chaoxing.balance

Emits exactly ONE line of JSON to stdout for the frontend to consume:

    success: {"type":"BALANCE", ...}
    failure: {"type":"ERROR","error":"<msg>","detail":"<type>"}  + exit code 1

This command is fully independent of ``chaoxing.api`` — it does NOT touch the
job argparse (--job-id/--accounts/--mode). It must be launched under an
interpreter that has volcengine-python-sdk installed (e.g. Anaconda):

    E:/Softwares/Anaconda/python.exe -m chaoxing.balance

All debug/diagnostic output goes to stderr; stdout is strictly one JSON line.
"""

import sys
import json
from datetime import datetime, timezone

from .ai.billing import query_balance


def _iso_timestamp() -> str:
    """Return current UTC time as ISO 8601 string with millisecond precision."""
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def _write_json_line(obj: dict) -> None:
    """Write a single compact JSON object as one line to stdout, then flush."""
    line = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def main() -> None:
    """Query the account balance and emit a single JSON line.

    Exits 0 on success (BALANCE), 1 on failure (ERROR).
    """
    try:
        balance = query_balance()
    except Exception as e:
        _write_json_line({
            "type": "ERROR",
            "error": str(e),
            "detail": type(e).__name__,
        })
        sys.exit(1)

    _write_json_line({
        "type": "BALANCE",
        "provider": "doubao",
        "accountId": balance.get("accountId"),
        "availableBalance": balance.get("availableBalance"),
        "cashBalance": balance.get("cashBalance"),
        "creditLimit": balance.get("creditLimit"),
        "arrearsBalance": balance.get("arrearsBalance"),
        "freezeAmount": balance.get("freezeAmount"),
        "currency": balance.get("currency", "CNY"),
        "checkedAt": _iso_timestamp(),
    })


if __name__ == "__main__":
    main()
