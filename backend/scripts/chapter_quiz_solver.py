"""
章节测试自动解答器 — Chapter Quiz Auto-Solver

Backward-compatible shim — delegates to chaoxing.solvers.quiz.
All real logic lives in chaoxing/solvers/quiz/solver.py.
"""
from chaoxing.solvers.quiz.solver import ChapterQuizSolver, main
from chaoxing.solvers.quiz.stats import QuizStats

if __name__ == "__main__":
    main()
