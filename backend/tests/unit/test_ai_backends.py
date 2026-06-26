"""Tests for AI backend solvers and factory functions."""

from unittest import mock

import pytest

from chaoxing.ai._base import AISolver
from chaoxing.ai.doubao import DoubaoAPISolver
from chaoxing.ai.router import get_ai_solver, ai_solve_quiz
from chaoxing.exceptions import ConfigError


class TestProviderNames:
    """Verify provider_name property returns correct identifiers."""

    def test_doubao_provider_name(self):
        """DoubaoAPISolver.provider_name should return 'doubao-api'."""
        solver = DoubaoAPISolver()
        assert solver.provider_name == "doubao-api"



class TestAISolverFactory:
    """Test get_ai_solver factory with various providers."""

    @mock.patch("chaoxing.ai.router.cfg")
    def test_get_doubao_solver(self, mock_cfg):
        """get_ai_solver should return DoubaoAPISolver when provider is 'doubao-api'."""
        mock_cfg.return_value = "doubao-api"
        solver = get_ai_solver()
        assert isinstance(solver, DoubaoAPISolver)

    @mock.patch("chaoxing.ai.router.cfg")
    def test_get_invalid_provider_raises(self, mock_cfg):
        """get_ai_solver should raise ConfigError for unknown provider."""
        mock_cfg.return_value = "unknown-provider-xyz"
        with pytest.raises(ConfigError, match="Unknown AI provider"):
            get_ai_solver()


class TestAISolveQuizWrapper:
    """Test the ai_solve_quiz backward-compatible wrapper."""

    @mock.patch("chaoxing.ai.router.get_ai_solver")
    def test_ai_solve_quiz_delegates_to_solver(self, mock_get_solver):
        """ai_solve_quiz should delegate to the configured solver's solve_quiz_text."""
        mock_solver = mock.MagicMock(spec=AISolver)
        mock_solver.solve_quiz_text.return_value = [
            {"index": 1, "answer": "A"},
            {"index": 2, "answer": "B"},
        ]
        mock_get_solver.return_value = mock_solver

        questions = [
            {"index": 1, "question": "What is 2+2?", "options": ["A. 3", "B. 4"]},
        ]
        result = ai_solve_quiz(questions, "Math", "Quiz 1")

        mock_solver.solve_quiz_text.assert_called_once_with(
            questions, "Math", "Quiz 1"
        )
        assert result == [{"index": 1, "answer": "A"}, {"index": 2, "answer": "B"}]

    @mock.patch("chaoxing.ai.router.get_ai_solver")
    def test_ai_solve_quiz_empty_questions(self, mock_get_solver):
        """ai_solve_quiz should handle empty question list."""
        mock_solver = mock.MagicMock(spec=AISolver)
        mock_solver.solve_quiz_text.return_value = []
        mock_get_solver.return_value = mock_solver

        result = ai_solve_quiz([], "Course", "Section")
        assert result == []


