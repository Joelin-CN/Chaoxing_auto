# Changelog

本文件汇总各轮变更；历史明细见 [archive/](archive/) 下的原始 FIXLOG。

## [Unreleased] — 2026-08-07 目录规范化与迁移修复

### 修复
- 清理旧盘硬编码路径：`chaoxing_config.json` 移除失效的 `workspace_root`（旧路径 `E:/B306/...` 已不存在），代码中不再读取该字段。
- Python 解释器引用改为便携写法：新增专用 conda 环境 `chaoxing-backend`（含 `volcengine-python-sdk`），`balance.py` / `billing.py` / 文档中的 `E:/Softwares/Anaconda/python.exe` 全部替换为环境激活方式或 `CHAOXING_BALANCE_PYTHON` 覆盖。
- 修复 `solver.py` 把临时 JS / 截图写入源码包目录的问题（统一写入 `data/temp/`）。
- 修复 `electron-builder.yml` 未排除 `chrome-profiles/`（登录态 cookie）、`screenshots/`、`documents/`、`etc/`、`tests/` 的打包隐患：改为白名单只打运行时必需文件。

### 目录规范化（对齐 monorepo 规范）
- 运行时产物迁至仓库根 `data/`：`passwords/`、`chrome-profiles/`、`screenshots/`、`output/`、`temp/`、`logs/`、`documents/`（全部 git 忽略）。
- 第三方参考脚本迁至 `references/`（git 忽略，仅索引）。
- `docs/` 重构为 `design/`（api / integration / architecture / reference）、`changelog/`、`reports/analysis/`、`sessions/`、`validation/`、`logs/`，并新增 [docs/README.md](../README.md) 索引。
- 新增 `AGENTS.md`、`.gitattributes`、`data/README.md`、`references/README.md`、`backend/chaoxing_config.example.json`；真实 `chaoxing_config.json`、`backend/.claude/plans/`、`backend/etc/`、`backend/documents/` 移除 git 跟踪。

### 工程
- 新增环境变量 `CHAOXING_DATA_DIR`（运行产物根，默认 `<仓库>/data` 或 `userData/data`），前端 `backendPath.ts` / `pythonBridge` / 各 IPC handler 同步透传。
- 前端默认 Python 路径指向 `chaoxing-backend` 环境（可在设置中覆盖）。
- 清理跟踪的临时垃圾文件 `chaoxing/solvers/quiz/tmp90t7oahm.js`。

## 历史归档

| 日期 | 文档 | 内容 |
| --- | --- | --- |
| 2026-06-26 | [FIXLOG_20260626_vue-tsc_typecheck.md](archive/FIXLOG_20260626_vue-tsc_typecheck.md) | vue-tsc 工具链升级 & 类型检查修复 |
| 2026-06-26 | [FIXLOG_20260626_balance_query.md](archive/FIXLOG_20260626_balance_query.md) | 余额查询功能接入 |
| 2026-06-26 | [FIXLOG_20260626_apiclient_singleton.md](archive/FIXLOG_20260626_apiclient_singleton.md) | API 客户端单例化 |
| 2026-06-25 | [FIXLOG_20260625_security_stability.md](archive/FIXLOG_20260625_security_stability.md) | 安全漏洞修复 & 稳定性加固 |
| 2026-06-24 | [FIXLOG_20250624_headed_e2e.md](archive/FIXLOG_20250624_headed_e2e.md) | Headed 模式全流程 E2E 验证 |
| 2026-06-24 | [FIXLOG_20250624_e2e_backend_verify.md](archive/FIXLOG_20250624_e2e_backend_verify.md) | 后端重构验证 + 多账户 E2E |
| 2026-06-24 | [FIXLOG_20250624_bat_ps1_modes.md](archive/FIXLOG_20250624_bat_ps1_modes.md) | BAT/PS1 六模式修复 |
| 2026-06-24 | [CHANGELOG_20250624.md](archive/CHANGELOG_20250624.md) | 全脚本优化日志 |
| 2026-06-23 | [DEEPSEEK_FIXES.md](archive/DEEPSEEK_FIXES.md) | DeepSeek 自动解题模块修复 |
| 2026-06-23 | [FIXLOG.md](archive/FIXLOG.md) | CLI Panel 重构 + 多账户 |
