"""Tests for chaoxing.platform.auth — credential parsing and login helpers."""
from chaoxing.platform.auth import _parse_credential_block


class TestParseCredentialBlock:
    """Credential parsing from passwords/chaoxing.txt format."""

    def test_simple_format(self):
        block = """
        account:13251303918
        password:test123
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "13251303918"
        assert result["password"] == "test123"
        assert result["index"] == 0

    def test_indexed_format(self):
        block = """
        account[2]:13800138000
        password[2]:pwd456
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "13800138000"
        assert result["password"] == "pwd456"
        assert result["index"] == 2

    def test_with_website(self):
        block = """
        website:https://example.com/login
        account:test@example.com
        password:secret
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["website"] == "https://example.com/login"
        assert result["account"] == "test@example.com"

    def test_default_website_when_missing(self):
        block = """
        account:13800138000
        password:pwd
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert "passport2.chaoxing.com" in result["website"]

    def test_quoted_values_stripped(self):
        block = """
        account:"13800138000"
        password:"quoted_pwd"
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "13800138000"
        assert result["password"] == "quoted_pwd"
        assert '"' not in result["account"]

    def test_braced_values_stripped(self):
        block = """
        account:{13800138000}
        password:{braced_pwd}
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "13800138000"
        assert result["password"] == "braced_pwd"

    def test_empty_block_returns_none(self):
        result = _parse_credential_block("")
        assert result is None

    def test_missing_password_returns_none(self):
        block = "account:test"
        result = _parse_credential_block(block)
        assert result is None

    def test_extra_fields_ignored(self):
        block = """
        account:test
        password:test123
        extra_field:should_be_ignored
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "test"

    def test_chinese_labels(self):
        block = """
        账号:13800138000
        密码:mypassword
        网站:https://example.com
        """
        result = _parse_credential_block(block)
        assert result is not None
        assert result["account"] == "13800138000"
        assert result["password"] == "mypassword"
        assert result["website"] == "https://example.com"
