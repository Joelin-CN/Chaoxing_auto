# 文档中心

本目录是项目的文档唯一入口，按类型归档，每个子目录一个用途：

| 子目录 | 用途 | 入口 |
| --- | --- | --- |
| design/ | 常青设计文档（架构 / API / 整合 / 设计参考） | [design/](design/) |
| changelog/ | 版本变更 | [CHANGELOG.md](changelog/CHANGELOG.md) |
| reports/ | 过程报告（analysis / fixes / updates） | [reports/](reports/) |
| sessions/ | 会话总结与 Handoff 记录 | [sessions/](sessions/) |
| validation/ | 验证清单 | [validation/](validation/) |
| logs/ | 开发日志 | [logs/](logs/) |

## 快速导航

| 文档 | 内容 |
| --- | --- |
| [design/architecture.md](design/architecture.md) | 架构概览 |
| [design/api.md](design/api.md) | 前后端完整 API 契约（三层协议） |
| [design/integration.md](design/integration.md) | 前后端整合细节与运行约定 |
| [design/reference/API_REFERENCE.md](design/reference/API_REFERENCE.md) | Python/JS/CLI 三层内部接口参考 |
| [design/auto-solution-design.md](design/auto-solution-design.md) | 自动答题方案设计 |

## 归档规则

- 架构 / 接口 / 数据 / 部署等常青文档 → `design/`
- 版本变更 → `changelog/CHANGELOG.md`（原始 FIXLOG 归档于 `changelog/archive/`）
- 带日期的过程报告 → `reports/analysis|fixes|updates/`
- 每轮会话总结 / Handoff → `sessions/`
- 阶段验收清单 → `validation/`
- 日常开发日志 → `logs/`
