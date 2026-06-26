"""
Backward-compatible shim — delegates to chaoxing.orchestrator.

All real logic lives in chaoxing/orchestrator.py.
This file exists for backward compatibility with chaoxing_cli.ps1
and direct python scripts/chaoxing_orchestrator.py invocations.
"""
from chaoxing.orchestrator import (
    main,
    run_for_account,
    process_course,
    cmd_status,
    ensure_logged_in,
    build_dynamic_course_config,
    discover_courses,
    save_discovered_state,
    _parse_accounts_arg,
    _run_account_in_thread,
)

if __name__ == "__main__":
    main()
