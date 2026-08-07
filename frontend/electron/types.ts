export interface Account {
  id: number
  username: string
  nickname?: string
  avatar?: string
  school?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Course {
  id: string
  name: string
  accountId: number
  courseId: string
  classId?: string
  progress: number
  status: 'not_started' | 'in_progress' | 'completed' | 'failed'
  sections?: CourseSection[]
  /** Explicit task counts from discovery (preferred over deriving from sections). */
  totalSections?: number
  completedSections?: number
  teacher?: string
  lastActivity?: string
}

export interface CourseSection {
  id: string
  title: string
  type: 'video' | 'quiz' | 'document' | 'discussion' | 'other'
  status: 'pending' | 'completed' | 'failed' | 'skipped'
  progress: number
}

export interface AccountStatus {
  accountId: number
  loggedIn: boolean
  scanning: boolean
  running: boolean
  lastScanAt?: string
  courseCount: number
  completedCount: number
}

export type JobPhase =
  | 'idle'
  | 'login'
  | 'scan_courses'
  | 'process_sections'
  | 'solve_quiz'
  | 'completed'
  | 'paused'
  | 'stopped'
  | 'error'

export interface JobLaneStatus {
  accountId: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'stopped' | 'error'
  progress: number
  currentTask?: string
  currentPhase?: string
  errorMessage?: string
}

export interface JobStatus {
  jobId: string
  status: 'running' | 'paused' | 'completed' | 'stopped' | 'error'
  phase: JobPhase
  progress: number
  message?: string
  startedAt?: string
  finishedAt?: string
  accountIds: number[]
  courseIds?: string[]
  phaseIndex?: number
  lanes?: JobLaneStatus[]
}

export interface StartJobPayload {
  accountIds: number[]
  courseIds?: string[]
  mode?: 'full' | 'scan_only' | 'solve_only'
  /**
   * Free-form options forwarded from the renderer. Recognised keys:
   *  - dryRun:  boolean — "模拟运行": solve/fill/AI-grade but never submit.
   *  - focus:   'quiz' | 'content' — restrict a full run to one phase
   *             (仅刷题 / 仅内容). 'quiz' is expressed via mode='solve_only';
   *             'content' adds the --content-only backend flag.
   */
  options?: {
    dryRun?: boolean
    focus?: 'quiz' | 'content'
    [key: string]: unknown
  }
}

export interface JobControlPayload {
  jobId: string
  accountIds?: number[]
}

/**
 * Frontend → Python: a human's response to a captcha/verification ticket.
 * `answer` is the typed-in code; `action: 'skip'` abandons the current course
 * for that account instead. Exactly one of the two is meaningful.
 */
export interface ResolveTicketPayload {
  ticketId: string
  accountId: number
  answer?: string
  action?: 'skip'
}

export interface ScanCoursesPayload {
  accountIds: number[]
  courseIds?: string[]
}

export interface Settings {
  pythonPath: string
  maxWorkers: number
  headless: boolean
  browserTimeout: number
  quizSolver: 'deepseek' | 'doubao' | 'local'
  deepseekModel: string
  doubaoModel: string
  autoResolve: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export const DEFAULT_SETTINGS: Settings = {
  // Recommended interpreter: the dedicated conda env with volcengine-python-sdk
  // installed (created for the balance query). Overridable via a custom
  // Settings.pythonPath or the CHAOXING_BALANCE_PYTHON environment variable.
  pythonPath: 'E:\\Softwares\\Anaconda\\envs\\chaoxing-backend\\python.exe',
  maxWorkers: 2,
  headless: true,
  browserTimeout: 30000,
  quizSolver: 'deepseek',
  deepseekModel: 'deepseek-v4-pro',
  doubaoModel: 'doubao-pro',
  autoResolve: true,
  logLevel: 'info',
}

export interface Ticket {
  id: string
  jobId: string
  type: 'captcha' | 'verification' | 'warning' | 'error'
  title: string
  message: string
  imageBase64?: string
  options?: string[]
  resolved: boolean
  resolution?: string
  createdAt: string
  resolvedAt?: number
}

export interface PythonProgressEvent {
  type: 'PROGRESS'
  jobId: string
  percent: number
  message: string
  phase?: string
  phaseIndex?: number
}

export interface PythonLogEvent {
  type: 'LOG'
  jobId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface PythonPhaseEvent {
  type: 'PHASE'
  jobId: string
  phase: JobPhase
  fromPhase?: JobPhase
  phaseIndex?: number
}

export interface PythonTicketEvent {
  type: 'TICKET'
  jobId: string
  ticket: Ticket
}

export interface PythonResultEvent {
  type: 'RESULT'
  jobId: string
  data: unknown
}

export interface PythonErrorEvent {
  type: 'ERROR'
  jobId: string
  error: string
  stack?: string
  phase?: JobPhase
  recoverable?: boolean
}

export interface PythonDoneEvent {
  type: 'DONE'
  jobId: string
}

export type PythonBridgeEvent =
  | PythonProgressEvent
  | PythonLogEvent
  | PythonPhaseEvent
  | PythonTicketEvent
  | PythonResultEvent
  | PythonErrorEvent
  | PythonDoneEvent

/**
 * Result of `python -m chaoxing.balance` — the Volcengine (Doubao) cash-balance
 * query. This is a standalone CLI decoupled from the job event stream: it takes
 * no --job-id/--accounts/--mode, emits a single line of JSON, and exits. All
 * monetary fields are strings (decimal precision preserved from the billing API).
 * Must be launched with the Anaconda interpreter, which has volcengine-python-sdk.
 */
export interface BalanceResult {
  type: 'BALANCE'
  provider: string
  accountId: number
  availableBalance: string
  cashBalance: string
  creditLimit: string
  arrearsBalance: string
  freezeAmount: string
  currency: string
  checkedAt: string
}

/**
 * Live system resource snapshot (`system:resources`). Sourced from Node's `os`
 * module in the main process — no Python involved. Memory is in GB (rounded to
 * one decimal); cpuPct is whole-percent CPU load sampled over a short window;
 * cores is the logical core count; uptimeSeconds is OS uptime.
 */
export interface SystemResources {
  ram: { used: number; total: number; free: number; pct: number }
  cpu: { pct: number; cores: number }
  uptimeSeconds: number
}

export const IPC_CHANNELS = {
  JOB_START: 'job:start',
  JOB_PAUSE: 'job:pause',
  JOB_RESUME: 'job:resume',
  JOB_STOP: 'job:stop',
  JOB_PAUSE_SELECTED: 'job:pause-selected',
  JOB_RESUME_SELECTED: 'job:resume-selected',
  JOB_STOP_SELECTED: 'job:stop-selected',
  JOB_STATUS: 'job:status',
  COURSES_SCAN: 'courses:scan',
  COURSES_LIST: 'courses:list',
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_STATUS: 'accounts:status',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  TICKETS_LIST: 'tickets:list',
  TICKETS_RESOLVE: 'tickets:resolve',
  JOB_RESOLVE_TICKET: 'job:resolve-ticket',
  BALANCE_QUERY: 'balance:query',
  SYSTEM_RESOURCES: 'system:resources',
  ON_PROGRESS: 'on-progress',
  ON_PHASE_CHANGE: 'on-phase-change',
  ON_LOG: 'on-log',
  ON_TICKET: 'on-ticket',
  ON_COMPLETED: 'on-completed',
  ON_ERROR: 'on-error',
  ON_RESULT: 'on-result',
  BACKEND_SETTINGS_GET: 'backend-settings:get',
  BACKEND_SETTINGS_SET: 'backend-settings:set',
} as const
