# 验证清单 — 前端鲁棒性与内存感知并发（2026-08-13）

> 状态：自动化验证已通过；P0 真实运行项待实机任务验证后勾选。

## P0（必须）

- [x] 后端全量单测：`python -m pytest tests/unit -q -s` 全部通过（572 tests）。
- [x] 前端类型检查：`npm run typecheck` 通过（vue-tsc 双配置）。
- [x] 前端 planner 单测：`npm test` 通过（vitest）。
- [x] 真实账号文件解析回归：`python -m chaoxing.accounts` 正确列出 3 个账号且不回显密码。
- [ ] 真实任务：勾选超过最大并发的账号启动，观察自动排队分批、通道「排队中」状态与预算仪表。
- [ ] 真实任务：观察 `MEMORY` 事件与 Dashboard「项目 Chrome 占用」随并发变化。
- [ ] AI 设置：保存合法 key 后「测试连通性」返回成功；保存 401 场景提示密钥无效。

## P1（重要）

- [ ] 账号增删改：新增复用空位、删除不重排；重启前端后列表保持且登录档案不错位。
- [ ] 自定义账号文件路径：选择有效文件后列表刷新；无效文件给出解析错误。
- [ ] 任务运行中锁定：运行中修改 AI 配置 / 账号被拒绝并提示。
- [ ] headed 模式切换后任务正常；`CHAOXING_ACCOUNTS_FILE` 生效于任务进程。

## P2（可选）

- [ ] 打包构建后 `.playwright/cli.config.json` 播种到 `userData/workspace`。
- [ ] 内存采样 PowerShell 不可用时的降级告警（仅估算值，任务不中断）。
