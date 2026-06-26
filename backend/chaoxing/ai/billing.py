"""
Volcano Engine (火山引擎) account balance query — Billing OpenAPI backend.

Queries the cash/account balance of the Volcano Engine account that owns the
Doubao (豆包) inference resources. This is SEPARATE from the Ark inference
endpoint used by ``doubao.py``:

    - doubao.py   -> Ark inference (ark.cn-beijing.volces.com), ARK_API_KEY,
                     returns per-request token usage only — NO balance.
    - billing.py  -> Billing OpenAPI (open.volcengineapi.com), AK/SK + V4 HMAC
                     signing, returns the account cash balance.

SDK: volcengine-python-sdk (>= 5.0.0). The import name is NOT ``volcengine`` —
each cloud service lives under ``volcenginesdk<service>``. The billing service
is ``volcenginesdkbilling``; core config/auth is ``volcenginesdkcore``.

IMPORTANT — lazy import: the SDK is only installed in the Anaconda interpreter,
NOT the system Python that runs the unit tests. The SDK is therefore imported
*inside* ``query_balance()`` so this module imports cleanly under any
interpreter (matching the lazy-import pattern in ``doubao.py``).
"""

import os
import re
from pathlib import Path

from ..exceptions import ConfigError, AIBackendError

WORKSPACE = Path(os.environ.get("CHAOXING_WORKSPACE",
    str(Path(__file__).parent.parent.parent)))
CREDS_FILE = WORKSPACE / "passwords" / "volc_billing.txt"

DEFAULT_REGION = "cn-north-1"
PROVIDER = "volc-billing"


# ══════════════════════════════════════════════════════════════════
#  Credentials
# ══════════════════════════════════════════════════════════════════

def _load_billing_credentials() -> dict:
    """Parse VOLC_ACCESS_KEY / VOLC_SECRET_KEY (and optional region) from
    passwords/volc_billing.txt.

    File format (both shell-export and plain env syntax accepted)::

        export VOLC_ACCESS_KEY="AK..."
        export VOLC_SECRET_KEY="SK..."
        region="cn-north-1"     # optional, defaults to cn-north-1

    Returns:
        dict with keys: access_key, secret_key, region.

    Raises:
        ConfigError: file missing, or AK/SK could not be parsed.
    """
    if not CREDS_FILE.exists():
        raise ConfigError(
            f"Volcano billing credentials not found: {CREDS_FILE}\n"
            f"Create passwords/volc_billing.txt with VOLC_ACCESS_KEY and "
            f"VOLC_SECRET_KEY (see FRONTEND_BACKEND_API.md)."
        )

    content = CREDS_FILE.read_text(encoding="utf-8")

    def _extract(name: str) -> str:
        # Quoted form first (export KEY="..."), then bare form (KEY=value).
        m = re.search(rf'{name}\s*=\s*"([^"]+)"', content)
        if not m:
            m = re.search(rf'{name}\s*=\s*(\S+)', content)
        return m.group(1).strip() if m else ""

    access_key = _extract("VOLC_ACCESS_KEY")
    secret_key = _extract("VOLC_SECRET_KEY")
    region = _extract("region") or DEFAULT_REGION

    if not access_key:
        raise ConfigError(
            f"Could not parse VOLC_ACCESS_KEY from {CREDS_FILE}. "
            f'Expected format: VOLC_ACCESS_KEY="AK..."'
        )
    if not secret_key:
        raise ConfigError(
            f"Could not parse VOLC_SECRET_KEY from {CREDS_FILE}. "
            f'Expected format: VOLC_SECRET_KEY="SK..."'
        )

    return {"access_key": access_key, "secret_key": secret_key, "region": region}


# ══════════════════════════════════════════════════════════════════
#  Balance query
# ══════════════════════════════════════════════════════════════════

def query_balance() -> dict:
    """Query the Volcano Engine account cash balance via the Billing OpenAPI.

    Loads AK/SK from passwords/volc_billing.txt, configures the SDK, and calls
    ``BILLINGApi.query_balance_acct``. The SDK is imported lazily so this module
    can be imported (and tested) under interpreters where the SDK is absent.

    Returns:
        Normalized camelCase dict::

            {"accountId": int, "availableBalance": str, "cashBalance": str,
             "creditLimit": str, "arrearsBalance": str, "freezeAmount": str,
             "currency": "CNY"}

    Raises:
        ConfigError: credentials missing/invalid.
        AIBackendError: SDK not installed (retryable=False, message points to
            Anaconda), or the API call failed.
    """
    creds = _load_billing_credentials()

    # Lazy import — the SDK only exists in the Anaconda interpreter.
    try:
        import volcenginesdkcore
        import volcenginesdkbilling
    except ModuleNotFoundError as e:
        raise AIBackendError(
            "volcengine-python-sdk is not installed in this interpreter "
            f"({e.name}). The balance query must run under an interpreter that "
            "has the SDK installed (e.g. Anaconda: "
            "E:/Softwares/Anaconda/python.exe -m chaoxing.balance).",
            provider=PROVIDER,
            retryable=False,
        ) from e

    try:
        cfg = volcenginesdkcore.Configuration()
        cfg.ak = creds["access_key"]
        cfg.sk = creds["secret_key"]
        cfg.region = creds["region"]
        volcenginesdkcore.Configuration.set_default(cfg)

        api = volcenginesdkbilling.BILLINGApi()
        resp = api.query_balance_acct(
            volcenginesdkbilling.QueryBalanceAcctRequest()
        )
    except Exception as e:
        raise AIBackendError(
            f"Volcano billing API call failed: {type(e).__name__}: {e}",
            provider=PROVIDER,
            retryable=False,
        ) from e

    return _normalize_balance(resp)


def _normalize_balance(resp) -> dict:
    """Map a QueryBalanceAcctResponse to the camelCase contract dict."""
    return {
        "accountId": getattr(resp, "account_id", None),
        "availableBalance": getattr(resp, "available_balance", None),
        "cashBalance": getattr(resp, "cash_balance", None),
        "creditLimit": getattr(resp, "credit_limit", None),
        "arrearsBalance": getattr(resp, "arrears_balance", None),
        "freezeAmount": getattr(resp, "freeze_amount", None),
        "currency": "CNY",
    }
