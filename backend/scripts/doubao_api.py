"""
Doubao (豆包) API Quiz Solver — Volcano Ark / 火山方舟

Backward-compatible shim — delegates to chaoxing.ai.doubao.
All real logic lives in chaoxing/ai/doubao.py.
"""
from chaoxing.ai.doubao import (
    DoubaoAPISolver,
    doubao_solve_quiz,
    doubao_solve_quiz_image,
    doubao_ask_image,
)
