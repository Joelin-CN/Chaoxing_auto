"""Standalone Ark (Doubao) connectivity test for the Electron AI panel."""

import json
import sys

from .ai.doubao import _load_credentials
from .logging_setup import log

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def _write(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))


def run_test() -> None:
    """Call Ark /models with the doubao.txt credentials, one JSON line out."""
    if OpenAI is None:
        _write({"type": "AI_TEST", "ok": False,
                "reason": "此解释器未安装 openai，请在设置中选择含 openai 的 Python"})
        sys.exit(1)
    try:
        creds = _load_credentials()
        client = OpenAI(base_url="https://ark.cn-beijing.volces.com/api/v3",
                        api_key=creds["api_key"], timeout=30, max_retries=0)
        models = client.models.list()
        log(f"AI connectivity test OK: {len(models.data or [])} models", "OK")
        _write({"type": "AI_TEST", "ok": True, "models": len(models.data or [])})
    except Exception as e:
        log(f"AI connectivity test failed: {str(e)[:200]}", "ERROR")
        _write({"type": "AI_TEST", "ok": False, "reason": str(e)[:300]})
        sys.exit(1)


if __name__ == "__main__":
    run_test()
