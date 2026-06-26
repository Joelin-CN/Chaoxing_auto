import { contextBridge, ipcRenderer } from 'electron'
import type {
  StartJobPayload,
  JobStatus,
  ScanCoursesPayload,
  Course,
  Account,
  AccountStatus,
  Settings,
  Ticket,
  PythonProgressEvent,
  PythonPhaseEvent,
  PythonLogEvent,
  PythonTicketEvent,
  PythonErrorEvent,
  PythonDoneEvent,
  PythonResultEvent,
  JobControlPayload,
  ResolveTicketPayload,
  BalanceResult,
  SystemResources,
} from './types'
import { IPC_CHANNELS } from './types'

export interface ElectronAPI {
  startJob: (payload: StartJobPayload) => Promise<{ jobId: string }>
  pauseJob: (jobId: string) => Promise<void>
  resumeJob: (jobId: string) => Promise<void>
  stopJob: (jobId: string) => Promise<void>
  pauseSelected: (jobId: string, accountIds: number[]) => Promise<void>
  resumeSelected: (jobId: string, accountIds: number[]) => Promise<void>
  stopSelected: (jobId: string, accountIds: number[]) => Promise<void>
  getJobStatus: (jobId: string) => Promise<JobStatus>
  scanCourses: (payload: ScanCoursesPayload) => Promise<Course[]>
  getCourses: (accountId: number) => Promise<Course[]>
  getAccounts: () => Promise<Account[]>
  getAccountStatus: (accountId: number) => Promise<AccountStatus>
  getSettings: () => Promise<Settings>
  setSettings: (partial: Partial<Settings>) => Promise<void>
  getTickets: () => Promise<Ticket[]>
  resolveTicket: (ticketId: string, resolution: string) => Promise<void>
  resolveCaptcha: (payload: ResolveTicketPayload) => Promise<void>
  getBalance: () => Promise<BalanceResult>
  getSystemResources: () => Promise<SystemResources>
  onProgress: (cb: (event: PythonProgressEvent) => void) => () => void
  onPhaseChange: (cb: (event: PythonPhaseEvent) => void) => () => void
  onLog: (cb: (event: PythonLogEvent) => void) => () => void
  onTicket: (cb: (event: PythonTicketEvent) => void) => () => void
  onCompleted: (cb: (event: PythonDoneEvent) => void) => () => void
  onError: (cb: (event: PythonErrorEvent) => void) => () => void
  onResult: (cb: (event: PythonResultEvent) => void) => () => void
  removeAllListeners: (channel: string) => void
  getBackendSettings: () => Promise<Settings>
  setBackendSettings: (partial: Partial<Settings>) => Promise<void>
}

function makeListener<T>(channel: string): (cb: (event: T) => void) => () => void {
  return (cb: (event: T) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => cb(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  startJob: (payload: StartJobPayload) => ipcRenderer.invoke(IPC_CHANNELS.JOB_START, payload),
  pauseJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_PAUSE, jobId),
  resumeJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_RESUME, jobId),
  stopJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_STOP, jobId),
  pauseSelected: (jobId: string, accountIds: number[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_PAUSE_SELECTED, { jobId, accountIds } satisfies JobControlPayload),
  resumeSelected: (jobId: string, accountIds: number[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_RESUME_SELECTED, { jobId, accountIds } satisfies JobControlPayload),
  stopSelected: (jobId: string, accountIds: number[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_STOP_SELECTED, { jobId, accountIds } satisfies JobControlPayload),
  getJobStatus: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.JOB_STATUS, jobId),
  scanCourses: (payload: ScanCoursesPayload) => ipcRenderer.invoke(IPC_CHANNELS.COURSES_SCAN, payload),
  getCourses: (accountId: number) => ipcRenderer.invoke(IPC_CHANNELS.COURSES_LIST, accountId),
  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_LIST),
  getAccountStatus: (accountId: number) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_STATUS, accountId),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (partial: Partial<Settings>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, partial),
  getTickets: () => ipcRenderer.invoke(IPC_CHANNELS.TICKETS_LIST),
  resolveTicket: (ticketId: string, resolution: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TICKETS_RESOLVE, ticketId, resolution),
  resolveCaptcha: (payload: ResolveTicketPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.JOB_RESOLVE_TICKET, payload),
  getBalance: () => ipcRenderer.invoke(IPC_CHANNELS.BALANCE_QUERY),
  getSystemResources: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_RESOURCES),
  onProgress: makeListener<PythonProgressEvent>(IPC_CHANNELS.ON_PROGRESS),
  onPhaseChange: makeListener<PythonPhaseEvent>(IPC_CHANNELS.ON_PHASE_CHANGE),
  onLog: makeListener<PythonLogEvent>(IPC_CHANNELS.ON_LOG),
  onTicket: makeListener<PythonTicketEvent>(IPC_CHANNELS.ON_TICKET),
  onCompleted: makeListener<PythonDoneEvent>(IPC_CHANNELS.ON_COMPLETED),
  onError: makeListener<PythonErrorEvent>(IPC_CHANNELS.ON_ERROR),
  onResult: makeListener<PythonResultEvent>(IPC_CHANNELS.ON_RESULT),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  getBackendSettings: () => ipcRenderer.invoke(IPC_CHANNELS.BACKEND_SETTINGS_GET),
  setBackendSettings: (partial: Partial<Settings>) => ipcRenderer.invoke(IPC_CHANNELS.BACKEND_SETTINGS_SET, partial),
} satisfies ElectronAPI)
