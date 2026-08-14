# Changelog

本文件汇总各轮变更；历史明细见 [archive/](archive/) 下的原始 FIXLOG。

## 2026-08-14 — 稳定性与拟人化改造（外部脚本调研 + 站点实测）

### 修复
- 账号级失败不再误报成功：`run_multi_account` 收集线程结果，登录失败/线程崩溃抛
  `AccountRunError`；`api.py` 对用户停止发 `stopped + ERROR + DONE`。
- 内存采样：无 Chrome 进程时输出 0，不再报 `Memory sampler degraded`。
- 账号增删改后列表即时刷新（`refreshAccounts` 绕过 `loaded` 缓存）；设置页账号文件
  标签回读后端；账号列表带真实登录网址。
- 课程扫描：卡片懒加载“滚动-等待-数量稳定”后再抽取（修复 11 门被抽成 1 门）。
- 多账号并发探测 playwright 会话串行化 + 超时兜底（修复 `playwright-cli list` 挂死）。
- 停止后重启不再复用死会话；运行中进度在账号级 `DONE` 前封顶 99%。
- 视频播放器：20s 无进度自恢复看门狗、播放失败有界重试、轮询抖动。
- 关键路径固定等待改为随机抖动（登录、扫描、导航、内容处理、答题提交）。
- 真实提交模式章节测验间 60–120s 随机间隔，降低触发提交验证概率。

### 验证
- 后端单元测试 587 通过；前端类型检查通过。
- 真实界面 E2E（真实账号、模拟运行不提交）28/28 通过。
- 识图（vision）复核：修复识图服务超时后，16 张关键截图逐张核对与断言一致，
  含修复前「执行完成 100% vs FAILED」矛盾截图与修复后「执行失败」对照。

## 2026-08-13（续二）— 账号解析 / CLI / 状态机修复

### 修复
- 多账号凭证解析崩溃：`read_all_chaoxing_credentials()` 对无 `[N]` 下标的后续账号块
  执行 `max(str) + 1` 抛 `TypeError`；改用独立整数索引集合分配序号。
- `website[N]` 写入后无法读回：`_parse_credential_block()` 只识别无下标的 `website`；
  现在兼容 `website[N]` / `网站[N]`，账号增删改不再丢自定义登录网址。
- CLI shim 完全失效：`scripts/chaoxing_orchestrator.py` / `utils.py` / `chapter_*`
  import 已删除符号；重建向后兼容入口，ps1 的 P/Q 改走 stdin 信号
  （`PAUSE`/`RESUME`/`STOP`），batch-test 参数名修正为 `--section`；并修复
  `Read-Host` 起始章节提示缺少闭合引号导致的 ps1 语法错误。
- Electron 失败任务被 `DONE` 翻转为 `completed`；旧任务 `exit`/`error` 事件误清新任务
  状态；全局清理增加“当前 bridge”守卫。
- 无凭证/无匹配账号时后端误报成功：`api.py` 启动前预检凭证与账号索引，失败发
  `ERROR + DONE`。
- 默认 Python 路径去除 `E:\Softwares\...` 硬编码（空 = PATH 上的 python）；退出清理
  改为按 `data/` 根过滤的定向进程清理；删除会污染账号数据的 `refreshAccountStatus`
  死代码。
- 前端类型清理：Electron `Settings` 移除 `deepseekModel` / `doubaoModel` /
  `autoResolve` 残留，`quizSolver` 统一为 `doubao`。

### 文档
- 同步根 README / frontend README / backend README / api.md / integration.md /
  API_SPEC.md（Store 9 个、IPC 30+8、真实数据接入现状、`--chromium-flags` 移除、
  `MEMORY` 事件、测试数 584）；architecture.md / API_REFERENCE.md /
  auto-solution-design.md 加历史参考横幅。

## 2026-08-13（续）— 设置项落地与文档校正

### 新增
- 「浏览器与系统」设置：Python 解释器路径、页面加载/快照/点击/视频观看/答题
  五项超时、日志保留天数；超时与重试通过 `CHAOXING_TIMEOUT_*` /
  `CHAOXING_RETRY_*` 环境变量注入后端（`config.py` 同时覆盖 legacy `cfg()` 与
  类型化配置）。
- 任务完成/异常时按「系统通知」开关推送 Electron 桌面通知；应用启动时按
  「日志保留」清理 `data/logs/*.log`。
- 前端关键设置操作（保存 AI 配置、账号增删改、切换账号文件、内存计划失败）
  写入日志面板与后端每日日志（账号掩码、密钥不落盘）。

### 移除
- 死开关：`autoResolveCaptcha` / `autoResolve`（后端无消费）、`videoSpeed`、
  `sectionDelay`（无后端对应），从类型与设置页摘除；验证码仍由后端按需自动
  识别，失败走人工工单。

### 文档
- 三份 README 与 `docs/design/api.md` 同步：`--chromium-flags` 移除、动态并发
  公式、新增 IPC 通道与 `MEMORY` 事件、deepseek-web 已不支持、真实数据接入
  现状、测试数量 578。

## 2026-08-13 — 前端鲁棒性与内存感知并发

### 新增
- 设置页新增「AI 推理 · 火山方舟」：API Key + 模型 ID 写入本地
  `doubao.txt`（原子写 + 备份 + 尾号回显）+ 方舟连通性测试。
- 账号管理 UI：增删改账号直接写入当前生效账号文件，支持自定义账号文件路径
  （文件选择器 + 恢复默认 + 解析校验）；删除不重排、新增复用空位。
- 内存感知并发：启动前按 `(总内存 − 基线) × 75%` 与 CPU 线程数动态计算最大并发，
  运行中每 5 秒实测 Chrome 进程树持续收紧，超预算账号自动排队分批跑完；
  `MEMORY` 事件驱动预算仪表与「排队中」通道状态。

### 修复
- `--chromium-flags` 从未到达 Chrome 的问题：省内存参数改经
  `.playwright/cli.config.json` 真实生效（GPU 进程 ~100MB → ~38MB）。
- `playwright-cli open` 传带 `&` 的登录 URL 被 cmd 截断：改为 `about:blank`
  打开后经 `pw_goto` 导航。
- 后端绝对 RAM 护栏（20/22/24G）改为任务级相对阈值；并发上限不再写死为 10。

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
