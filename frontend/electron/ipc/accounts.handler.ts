import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import { CODE_DIR, WORKSPACE_DIR, DATA_DIR } from '../backendPath'
import { getCurrentSettings } from './status.handler'
import type { Account } from '../types'
import { IPC_CHANNELS } from '../types'

/**
 * Account listing (`python -m chaoxing.accounts`) — reads the real accounts
 * configured in passwords/chaoxing.txt via the shared backend parser.
 *
 * Standalone CLI, decoupled from the job event stream. Prints a SINGLE line of
 * JSON to stdout and exits:
 *   - success → `{ "type":"ACCOUNTS", "accounts":[{index,account}, ...] }` (exit 0)
 *   - failure → `{ "type":"ERROR", "error":"...", "detail":"..." }`        (exit 1)
 *
 * SECURITY: the backend never emits passwords — only each account's index and
 * login id (phone/email). The renderer masks the id for display (maskPhone).
 */

/** Interpreter for the listing (no SDK needed — plain stdlib parse). */
function getAccountsPython(): string {
  return getCurrentSettings().pythonPath || 'python'
}

/** Hard timeout so a hung parse can't leave the renderer waiting forever. */
const ACCOUNTS_TIMEOUT_MS = 15_000

interface BackendAccount {
  index: number
  account: string
}

interface AccountsErrorPayload {
  type: 'ERROR'
  error: string
  detail?: string
}

interface AccountsOkPayload {
  type: 'ACCOUNTS'
  accounts: BackendAccount[]
}

/**
 * Map a backend account (index + raw login id) to the renderer Account shape.
 * `username` carries the raw id; the renderer masks it (138****0000) for
 * display, so the full id never needs to round-trip through the UI layer.
 * `id` = backend index, which is exactly what a job's `--accounts` expects.
 */
function toAccount(b: BackendAccount): Account {
  const now = new Date().toISOString()
  return {
    id: b.index,
    username: b.account,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }
}

function runAccountsQuery(): Promise<Account[]> {
  return new Promise((resolve, reject) => {
    const pythonPath = getAccountsPython()

    // Same env-whitelist policy as PythonBridge: never leak credentials.
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
    // Pin workspace so passwords/chaoxing.txt resolves to the right tree
    // regardless of launch cwd (see docs/design/integration.md §4).
    safeEnv.CHAOXING_WORKSPACE = process.env.CHAOXING_WORKSPACE ?? WORKSPACE_DIR
    safeEnv.CHAOXING_DATA_DIR = process.env.CHAOXING_DATA_DIR ?? DATA_DIR

    let child
    try {
      child = spawn(pythonPath, ['-m', 'chaoxing.accounts'], {
        cwd: CODE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: safeEnv,
      })
    } catch (err: any) {
      reject(new Error(`Failed to launch account listing: ${err?.message ?? err}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('读取账号列表超时（15 秒未返回）。'))
    }, ACCOUNTS_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8') })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8') })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGKILL')
      const hint =
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? `找不到 Python 解释器：${pythonPath}。请检查设置中的 Python 路径。`
          : err.message
      reject(new Error(hint))
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      // The backend's log() prints to stdout in subcommand mode, so the JSON
      // contract line is the LAST non-empty line (all logging precedes it).
      const line = stdout.split('\n').map((l) => l.trim()).filter(Boolean).pop()

      if (!line) {
        const detail = stderr.trim() ? ` (${stderr.trim()})` : ''
        reject(new Error(`读取账号列表无输出（exit ${code}）${detail}`))
        return
      }

      let parsed: AccountsOkPayload | AccountsErrorPayload
      try {
        parsed = JSON.parse(line)
      } catch {
        reject(new Error(`账号列表返回非 JSON：${line}`))
        return
      }

      if (parsed.type === 'ACCOUNTS') {
        resolve(parsed.accounts.map(toAccount))
        return
      }

      const errPayload = parsed as AccountsErrorPayload
      const detail = errPayload.detail ? `（${errPayload.detail}）` : ''
      reject(new Error(`${errPayload.error ?? '读取账号列表失败'}${detail}`))
    })
  })
}

export function registerAccountsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LIST, async () => {
    return runAccountsQuery()
  })
}
