# 计划：豆包/火山账户余额查询（独立 CLI 子命令）

## 目标
后端新增"查询火山引擎账户现金余额"能力，作为**独立 CLI 命令**运行，输出一行 JSON 给前端消费。

## 已确认的决策
- **余额口径**：账户现金余额（`query_balance_acct` 全部字段）
- **触发方式**：独立 CLI 子命令
- **签名/SDK**：用已装的 `volcengine-python-sdk`（conda base）
- **运行时**：余额查询固定用 `E:\Softwares\Anaconda\python.exe`
- **依赖**：`volcengine-python-sdk` 写进 `requirements.txt`

## 已勘查确认的技术事实
- API 方法：`volcenginesdkbilling.BILLINGApi.query_balance_acct(body)`，body 为空 `QueryBalanceAcctRequest()`
- 返回字段：`account_id:int`、`available_balance:str`、`cash_balance:str`、`credit_limit:str`、`arrears_balance:str`、`freeze_amount:str`
- 鉴权：`volcenginesdkcore.Configuration` 实例属性 `ak`/`sk`/`region`，经 `Configuration.set_default()` + `ApiClient()` 注入
- SDK 仅在 Anaconda，**不在** Python313（测试解释器）→ 必须延迟导入 + 测试全程 mock（与现有 `openai`/`doubao` 一致）

---

## 实现清单

### 1. 凭证（你提供，我只定格式）
`passwords/volc_billing.txt`（仿 `doubao.txt`）：
```
VOLC_ACCESS_KEY="AKLT..."
VOLC_SECRET_KEY="..."
# 可选：region（默认 cn-north-1）
region="cn-north-1"
```
我**不创建**此文件（含真实密钥）；只在代码里解析、在文档里写格式。建议你确认 `.gitignore` 已忽略 `passwords/`。

### 2. 新模块 `chaoxing/ai/billing.py`
- `_load_billing_credentials() -> dict`：解析 AK/SK/region，仿 `doubao._load_credentials()`，缺文件/缺字段抛 `ConfigError`。
- `query_balance() -> dict`：**延迟导入** `volcenginesdkcore`/`volcenginesdkbilling`；配置 ak/sk/region → 调 `query_balance_acct(QueryBalanceAcctRequest())` → 归一化返回：
  ```python
  {"accountId":int, "availableBalance":str, "cashBalance":str,
   "creditLimit":str, "arrearsBalance":str, "freezeAmount":str,
   "currency":"CNY"}
  ```
- 错误：SDK 缺失 → `AIBackendError(provider="volc-billing", retryable=False)` 并提示"需在 Anaconda 解释器下运行"；API 失败 → `AIBackendError`。

### 3. 新 CLI 入口 `chaoxing/balance.py`（`python -m chaoxing.balance`）
- 完全独立于 `api.py`（不碰其 argparse 的 `--job-id/--accounts/--mode` 必填项）。
- 调 `query_balance()`，向 **stdout 输出一行 JSON** 后退出：
  - 成功：`{"type":"BALANCE","provider":"doubao","accountId":...,"availableBalance":"...","cashBalance":"...","creditLimit":"...","arrearsBalance":"...","freezeAmount":"...","currency":"CNY","checkedAt":"<ISO8601>"}`
  - 失败：`{"type":"ERROR","error":"...","detail":"..."}`，exit code 1
- stderr 仅调试日志，stdout 严格单行 JSON（与现有协议一致，前端可直接 `JSON.parse`）。

### 4. `requirements.txt`
追加（带注释说明仅余额查询需要、且需 Anaconda 解释器）：
```
# 火山引擎账户余额查询（仅 chaoxing.balance 子命令需要；须在装有此 SDK 的解释器下运行，如 Anaconda）
volcengine-python-sdk>=5.0.0
```

### 5. 文档 `FRONTEND_BACKEND_API.md`
- 新增小节：余额查询子命令的调用方式、BALANCE JSON 结构、凭证文件格式。
- **明确标注**：此命令须用装有 SDK 的解释器（`E:\Softwares\Anaconda\python.exe`）拉起，前端 `pythonPath` 或单独的 spawn 路径需指向它。
- 附录 B 增加余额查询条目。

### 6. 测试 `tests/unit/test_billing.py`（在 Python313 下跑，全程 mock SDK）
- 凭证解析：正常 / 缺文件 / 缺 AK / 缺 SK。
- `query_balance()`：用 `sys.modules` 注入 mock 的 `volcenginesdkcore`/`volcenginesdkbilling`，断言归一化 dict 正确、字段齐全。
- SDK 缺失 → 抛 `AIBackendError` 且 message 含 Anaconda 提示。
- CLI `chaoxing.balance`：mock `query_balance` → 断言 stdout 单行 BALANCE JSON；异常 → ERROR JSON + exit 1。

## 验证
```bash
# 单元测试（系统 Python313，mock SDK）
python -m pytest tests/unit/ -q -s          # 预期 (521+新增) passed, 5 failed（预存）

# 真实联调（需你放好 AK/SK，必须用 Anaconda 解释器）
"E:/Softwares/Anaconda/python.exe" -m chaoxing.balance
```

## 边界 / 不做的事
- 不创建含真实密钥的 `passwords/volc_billing.txt`。
- 不改 `api.py` 的 job argparse（余额是独立入口，零耦合）。
- 不改前端（独立 repo）；仅在文档给契约。
- 不动验证码 TICKET 链路相关代码与那 5 个预存失败测试。

## 待你提供
- `passwords/volc_billing.txt` 里的 AK/SK（联调时需要；不提供也能跑单元测试）。
