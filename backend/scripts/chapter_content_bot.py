"""
章节内容自动完成机器人 — Chapter Content Auto-Completion Bot

Backward-compatible shim — delegates to chaoxing.solvers.content.
All real logic lives in chaoxing/solvers/content/bot.py.
"""
from chaoxing.solvers.content.bot import ChapterContentBot, main, ProgressTracker

if __name__ == "__main__":
    main()
