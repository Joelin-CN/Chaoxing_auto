import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { CODE_DIR, DATA_DIR, WORKSPACE_DIR } from '../backendPath'
import { resolvePythonPath } from '../python/resolve'
import { isJobActive } from './jobState'
import { IPC_CHANNELS } from '../types'

const DOUBAO_FILE = () => path.join(DATA_DIR, 'passwords', 'doubao.txt')

function parseDoubao(): { apiKey: string; model: string } {
  if (!fs.existsSync(DOUBAO_FILE())) return { apiKey: '', model: '' }
  const content = fs.readFileSync(DOUBAO_FILE(), 'utf-8')
  const key = content.match(/ARK_API_KEY\s*=\s*"?([^"\s]+)"?/)
  const model = content.match(/model\s*=\s*"?([^"\s]+)"?/)
  return { apiKey: key?.[1] ?? '', model: model?.[1] ?? '' }
}

function atomicWrite(file: string, text: string): void {
  if (fs.existsSync(file)) fs.writeFileSync(`${file}.bak`, fs.readFileSync(file))
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, text, 'utf-8')
  fs.renameSync(tmp, file)
}

function validateAndSave(apiKey: string, model: string): void {
  if (!model || !model.trim()) throw new Error('模型 ID 不能为空。')
  const existing = parseDoubao()
  const key = apiKey && apiKey.trim() ? apiKey.trim() : existing.apiKey
  if (!key) throw new Error('请填写 API Key。')
  if (!key.startsWith('ark-')) throw new Error('API Key 格式不正确：应以 ark- 开头。')
  fs.mkdirSync(path.dirname(DOUBAO_FILE()), { recursive: true })
  atomicWrite(DOUBAO_FILE(), `ARK_API_KEY="${key}"\nmodel="${model.trim()}"\n`)
  const verify = parseDoubao()
  if (verify.apiKey !== key || verify.model !== model.trim()) {
    throw new Error('写入后校验失败。')
  }
}

function runAiTest(): Promise<{ ok: boolean; reason?: string; models?: number }> {
  return new Promise((resolve) => {
    const python = resolvePythonPath().pythonPath
    const env: Record<string, string> = { PYTHONUNBUFFERED: '1' }
    for (const k of ['PATH', 'SYSTEMROOT', 'SYSTEMDRIVE', 'TEMP', 'TMP',
                     'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH']) {
      if (process.env[k] !== undefined) env[k] = process.env[k]!
    }
    env.CHAOXING_WORKSPACE = process.env.CHAOXING_WORKSPACE ?? WORKSPACE_DIR
    env.CHAOXING_DATA_DIR = process.env.CHAOXING_DATA_DIR ?? DATA_DIR
    const child = spawn(python, ['-m', 'chaoxing.ai_config', 'test'], {
      cwd: CODE_DIR, stdio: ['ignore', 'pipe', 'pipe'], env,
    })
    let out = ''
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill('SIGKILL')
        resolve({ ok: false, reason: '连通性测试超时。' })
      }
    }, 30000)
    child.stdout?.on('data', (c: Buffer) => { out += c.toString('utf-8') })
    child.on('error', (e) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve({ ok: false, reason: `无法启动 Python：${e.message}` })
      }
    })
    child.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        const line = out.split('\n').map(l => l.trim()).filter(Boolean).pop()
        const parsed = line ? JSON.parse(line) : null
        resolve(parsed?.type === 'AI_TEST' ? parsed
          : { ok: false, reason: 'AI 测试返回异常。' })
      } catch {
        resolve({ ok: false, reason: 'AI 测试返回无法解析。' })
      }
    })
  })
}

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_STATUS, () => {
    const c = parseDoubao()
    return { configured: Boolean(c.apiKey && c.model), model: c.model,
             keyTail: c.apiKey ? `…${c.apiKey.slice(-4)}` : '' }
  })
  ipcMain.handle(IPC_CHANNELS.AI_SET, (_e, payload: { apiKey?: string; model: string }) => {
    if (isJobActive()) throw new Error('任务运行中不可修改 AI 配置。')
    validateAndSave(payload?.apiKey ?? '', payload?.model ?? '')
  })
  ipcMain.handle(IPC_CHANNELS.AI_TEST, () => runAiTest())
}
