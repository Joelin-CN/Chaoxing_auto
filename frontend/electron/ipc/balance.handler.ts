import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import { CODE_DIR, WORKSPACE_DIR, DATA_DIR } from '../backendPath'
import { getCurrentSettings } from './status.handler'
import type { BalanceResult } from '../types'
import { IPC_CHANNELS } from '../types'

/**
 * Balance query (`python -m chaoxing.balance`) — see API manual §4.7.
 *
 * This is a standalone CLI, fully decoupled from the job event stream. It takes
 * none of the --job-id/--accounts/--mode args, prints a SINGLE line of JSON to
 * stdout, and exits:
 *   - success → `{ "type": "BALANCE", ... }`  (exit code 0)
 *   - failure → `{ "type": "ERROR", "error": "...", "detail": "..." }` (exit 1)
 *
 * IMPORTANT: it depends on `volcengine-python-sdk`. If the configured
 * interpreter lacks the SDK, set CHAOXING_BALANCE_PYTHON to one that has it
 * (e.g. an Anaconda python). Resolution order:
 *   1. CHAOXING_BALANCE_PYTHON env (explicit override).
 *   2. The configured task interpreter (Settings.pythonPath; defaults to the
 *      dedicated conda env that ships volcengine-python-sdk).
 *   3. 'python' on PATH.
 */

/** Interpreter for the balance query (must have volcengine-python-sdk). */
function getBalancePython(): string {
  const envOverride = process.env.CHAOXING_BALANCE_PYTHON
  if (envOverride) {
    console.log(`[balance] balance query interpreter (env override): ${envOverride}`)
    return envOverride
  }

  const configured = getCurrentSettings().pythonPath
  if (configured) {
    // A stale absolute path left in settings.json (e.g. a system Python without
    // the SDK) would fail at spawn with ENOENT. Skip it so we fall back to
    // something launchable instead of failing before even trying.
    if (!isPathLike(configured) || fs.existsSync(configured)) {
      console.log(`[balance] balance query interpreter (settings): ${configured}`)
      return configured
    }
    console.warn(
      `[balance] configured interpreter "${configured}" does not exist; ` +
        "falling back to 'python' on PATH",
    )
  }

  console.log('[balance] balance query interpreter (fallback): python')
  return 'python'
}

/** Rough check for an explicit path (as opposed to a bare command name). */
function isPathLike(value: string): boolean {
  return (
    value.includes('/') ||
    value.includes('\\') ||
    /^[A-Za-z]:/.test(value) ||
    value.toLowerCase().endsWith('.exe')
  )
}

/** Hard timeout so a hung SDK call can't leave the renderer waiting forever. */
const BALANCE_TIMEOUT_MS = 30_000

interface BalanceErrorPayload {
  type: 'ERROR'
  error: string
  detail?: string
}

function runBalanceQuery(): Promise<BalanceResult> {
  return new Promise((resolve, reject) => {
    const pythonPath = getBalancePython()

    // Same env-whitelist policy as PythonBridge: never leak ARK_API_KEY etc.
    // Credentials come from passwords/volc_billing.txt, not the environment.
    const ALLOWED_ENV = [
      'PATH', 'SYSTEMROOT', 'SYSTEMDRIVE', 'TEMP', 'TMP',
      'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
      'PYTHONPATH', 'PYTHONHOME',
      'CHAOXING_WORKSPACE', 'CHAOXING_DATA_DIR',
    ]
    const safeEnv: Record<string, string> = { PYTHONUNBUFFERED: '1' }
    for (const key of ALLOWED_ENV) {
      if (process.env[key] !== undefined) {
        safeEnv[key] = process.env[key]!
      }
    }
    // Pin workspace to the writable runtime root (see docs/design/integration.md §4),
    // so volc_billing.txt and config resolve there regardless of launch cwd.
    safeEnv.CHAOXING_WORKSPACE = process.env.CHAOXING_WORKSPACE ?? WORKSPACE_DIR
    safeEnv.CHAOXING_DATA_DIR = process.env.CHAOXING_DATA_DIR ?? DATA_DIR

    let child
    try {
      child = spawn(pythonPath, ['-m', 'chaoxing.balance'], {
        cwd: CODE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: safeEnv,
      })
    } catch (err: any) {
      reject(new Error(`Failed to launch balance query: ${err?.message ?? err}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('余额查询超时（30 秒未返回）。'))
    }, BALANCE_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8') })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8') })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // ENOENT → the configured interpreter was not found on PATH / at the path.
      const hint =
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? `找不到 Python 解释器：${pythonPath}。请检查设置中的 Python 路径，或设置 CHAOXING_BALANCE_PYTHON 环境变量指向装有 volcengine-python-sdk 的解释器。`
          : err.message
      reject(new Error(hint))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      // Parse the last non-empty stdout line as JSON (stdout is strictly single
      // line per the manual; we take the last to be robust against stray output).
      const line = stdout.split('\n').map((l) => l.trim()).filter(Boolean).pop()

      if (!line) {
        const detail = stderr.trim() ? ` (${stderr.trim()})` : ''
        reject(new Error(`余额查询无输出（exit ${code}）${detail}`))
        return
      }

      let parsed: BalanceResult | BalanceErrorPayload
      try {
        parsed = JSON.parse(line)
      } catch {
        reject(new Error(`余额查询返回非 JSON：${line}`))
        return
      }

      if (parsed.type === 'BALANCE') {
        resolve(parsed)
        return
      }

      // type === 'ERROR' (or exit ≠ 0): surface the backend's error + detail.
      const errPayload = parsed as BalanceErrorPayload
      const detail = errPayload.detail ? `（${errPayload.detail}）` : ''
      reject(new Error(`${errPayload.error ?? '余额查询失败'}${detail}`))
    })
  })
}

export function registerBalanceHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.BALANCE_QUERY, async () => {
    return runBalanceQuery()
  })
}
