"""Tests for playwright-cli availability guards (friendly missing-CLI errors)."""
from unittest.mock import patch, MagicMock

import pytest

import chaoxing.browser.engine as engine
from chaoxing.browser.engine import (
    PlaywrightCliMissingError,
    ensure_cli_available,
    pw,
)
import chaoxing.platform.auth as auth


@pytest.fixture(autouse=True)
def _clear_cache():
    engine._CLI_AVAILABILITY_CACHE.clear()
    yield
    engine._CLI_AVAILABILITY_CACHE.clear()


class TestEnsureCliAvailable:
    """ensure_cli_available() raises a friendly error when the CLI is absent."""

    def test_missing_cli_raises_with_guidance(self):
        with patch("shutil.which", return_value=None):
            with pytest.raises(PlaywrightCliMissingError) as ei:
                ensure_cli_available("playwright-cli.cmd")
        msg = str(ei.value)
        assert "playwright-cli" in msg
        assert "npm install -g playwright-cli" in msg

    def test_present_cli_passes_and_caches(self):
        calls = []

        def fake_which(name):
            calls.append(name)
            return "C:/npm/" + name

        with patch("shutil.which", side_effect=fake_which):
            ensure_cli_available("playwright-cli.cmd")
            ensure_cli_available("playwright-cli.cmd")
        assert len(calls) == 1, "second check must hit the cache"

    def test_cmd_suffix_falls_back_to_bare_name(self):
        # Configured as .cmd but only the bare name resolves (non-Windows style)
        def fake_which(name):
            return "C:/npm/playwright-cli" if name == "playwright-cli" else None

        with patch("shutil.which", side_effect=fake_which):
            ensure_cli_available("playwright-cli.cmd")  # must not raise


class TestPwGuard:
    """pw() converts a missing CLI into the friendly error."""

    def test_pw_raises_friendly_when_missing(self):
        with patch("shutil.which", return_value=None), \
             patch("chaoxing.config.cfg", return_value="no-such-cli.cmd"):
            with pytest.raises(PlaywrightCliMissingError):
                pw("snapshot")

    def test_pw_detects_not_recognized_stderr(self):
        # shell=True path: cmd.exe prints "not recognized" instead of
        # raising FileNotFoundError.
        engine._CLI_AVAILABILITY_CACHE.add("playwright-cli.cmd")
        result = MagicMock(
            returncode=1, stdout="",
            stderr="'playwright-cli.cmd' is not recognized as an internal or external command")
        with patch("chaoxing.config.cfg", return_value="playwright-cli.cmd"), \
             patch("chaoxing.browser.engine.subprocess.run", return_value=result):
            with pytest.raises(PlaywrightCliMissingError):
                pw("snapshot", use_shell=True)


class TestAuthGuards:
    """auth.py surfaces the friendly error instead of WinError 2."""

    def test_is_open_raises_friendly_on_file_not_found(self):
        with patch("chaoxing.config.cfg", return_value="no-such-cli.cmd"), \
             patch("shutil.which", return_value=None), \
             patch.object(auth, "_get_active_session", return_value="s-x"):
            with pytest.raises(PlaywrightCliMissingError):
                auth.is_chaoxing_browser_open()

    def test_close_logs_friendly_warning(self):
        with patch("chaoxing.config.cfg", return_value="no-such-cli.cmd"), \
             patch("chaoxing.platform.auth.subprocess.run",
                   side_effect=FileNotFoundError("winerror 2")), \
             patch("chaoxing.platform.auth.log") as mock_log:
            ok = auth.close_chaoxing_browser(0)
        assert ok is False
        logged = " ".join(str(c.args[0]) for c in mock_log.call_args_list)
        assert "npm install -g playwright-cli" in logged
