import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AccountLane,
  ExecutionStatus,
  JobHandle,
  LogLine,
  RuntimePhase,
  StartJobPayload,
} from '@/shared/lib/types'
import { createApiClient } from '@/shared/lib/apiClient'
import { formatDuration } from '@/shared/lib/formatDuration'
import { useAttentionStore } from '@/app/stores/attention.store'
import { useLogStore } from '@/app/stores/log.store'
import { useCaptchaStore } from '@/app/stores/captcha.store'
import { useCourseStore } from '@/app/stores/course.store'

const api = createApiClient()

export const useExecutionStore = defineStore('execution', () => {
  const status = ref<ExecutionStatus>('idle')
  const jobId = ref<string | null>(null)
  const phaseIndex = ref(0)
  const lanes = ref<AccountLane[]>([])
  const phases = ref<RuntimePhase[]>([])
  const progress = ref(0)
  const error = ref<string | null>(null)
  const startTime = ref<number | null>(null)
  const endTime = ref<number | null>(null)
  const elapsedMs = ref(0)
  const selectedLaneIds = ref<Set<string>>(new Set())

  const laneElapsedMs = ref<Record<string, number>>({})
  const laneStartedAt = ref<Record<string, number | null>>({})

  let globalTick: ReturnType<typeof setInterval> | null = null
  let activeStartedAt: number | null = null
  let activeElapsedBase = 0
  const eventCleanupFns: Array<() => void> = []
  let refreshInFlight = false

  const isRunning = computed(() => status.value === 'running')
  const isPaused = computed(() => status.value === 'paused')
  const isIdle = computed(() => status.value === 'idle')
  const currentPhase = computed(() => phases.value[phaseIndex.value] ?? null)
  const elapsedFormatted = computed(() => formatDuration(elapsedMs.value))
  const selectedLaneCount = computed(() => selectedLaneIds.value.size)
  const allLanesSelected = computed(() => lanes.value.length > 0 && selectedLaneIds.value.size === lanes.value.length)

  function laneElapsed(accountId: string): number {
    return laneElapsedMs.value[accountId] ?? 0
  }

  function laneElapsedFormatted(accountId: string): string {
    return formatDuration(laneElapsed(accountId))
  }

  function syncGlobalElapsed(): void {
    elapsedMs.value = activeStartedAt ? activeElapsedBase + (Date.now() - activeStartedAt) : activeElapsedBase
  }

  function startTimer(): void {
    if (!startTime.value) startTime.value = Date.now()
    if (activeStartedAt) return
    activeStartedAt = Date.now()
    syncGlobalElapsed()
    if (globalTick) clearInterval(globalTick)
    globalTick = setInterval(syncGlobalElapsed, 1000)
  }

  function stopTimer(): void {
    if (activeStartedAt) {
      activeElapsedBase += Date.now() - activeStartedAt
      activeStartedAt = null
    }
    if (globalTick) {
      clearInterval(globalTick)
      globalTick = null
    }
    elapsedMs.value = activeElapsedBase
  }

  function startLaneTimer(accountId: string): void {
    if (laneStartedAt.value[accountId]) return
    laneStartedAt.value = { ...laneStartedAt.value, [accountId]: Date.now() }
  }

  function stopLaneTimer(accountId: string): void {
    const startedAt = laneStartedAt.value[accountId]
    if (!startedAt) return
    laneElapsedMs.value = {
      ...laneElapsedMs.value,
      [accountId]: (laneElapsedMs.value[accountId] ?? 0) + (Date.now() - startedAt),
    }
    laneStartedAt.value = { ...laneStartedAt.value, [accountId]: null }
  }

  function recomputeLaneElapsed(accountId: string): void {
    const startedAt = laneStartedAt.value[accountId]
    if (!startedAt) return
    laneElapsedMs.value = {
      ...laneElapsedMs.value,
      [accountId]: (laneElapsedMs.value[accountId] ?? 0) + (Date.now() - startedAt),
    }
    laneStartedAt.value = { ...laneStartedAt.value, [accountId]: Date.now() }
  }

  function startAllLaneTimers(): void {
    for (const lane of lanes.value) {
      if (lane.status === 'running') startLaneTimer(lane.accountId)
    }
  }

  function stopAllLaneTimers(): void {
    for (const lane of lanes.value) stopLaneTimer(lane.accountId)
  }

  function unregisterEventListeners(): void {
    // Each listener was registered with a precise removal fn in eventCleanupFns,
    // so pop them off one by one. We deliberately do NOT call api.dispose() here:
    // `api` is a singleton shared by all 5 stores, and (in mock mode) dispose()
    // stops the in-flight job simulation — which would kill the job we just
    // started, since startJob() → registerEventListeners() → unregisterEventListeners()
    // runs in the same frame as api.startJob().
    while (eventCleanupFns.length) {
      const cleanup = eventCleanupFns.pop()
      try { cleanup?.() } catch {}
    }
  }

  function handleTerminalStatus(nextStatus: ExecutionStatus): void {
    status.value = nextStatus
    endTime.value = Date.now()
    stopTimer()
    stopAllLaneTimers()
    unregisterEventListeners()
  }

  function mergeHandle(handle: JobHandle): void {
    status.value = handle.status
    phaseIndex.value = handle.phaseIndex
    phases.value = handle.phases
    progress.value = handle.progress

    const previousById = new Map(lanes.value.map((lane) => [lane.accountId, lane]))
    lanes.value = handle.lanes

    for (const lane of lanes.value) {
      const previous = previousById.get(lane.accountId)
      if (lane.status === 'running' && previous?.status !== 'running') startLaneTimer(lane.accountId)
      if (previous?.status === 'running' && lane.status !== 'running') stopLaneTimer(lane.accountId)
    }

    for (const previous of previousById.values()) {
      if (!lanes.value.find((lane) => lane.accountId === previous.accountId)) stopLaneTimer(previous.accountId)
    }
  }

  function registerEventListeners(): void {
    unregisterEventListeners()

    const logStore = useLogStore()
    const attentionStore = useAttentionStore()
    const captchaStore = useCaptchaStore()

    eventCleanupFns.push(
      api.onProgress((event) => {
        if (event.jobId !== jobId.value) return
        progress.value = event.percent
        if (typeof event.phaseIndex === 'number') phaseIndex.value = event.phaseIndex
        // The progress event carries no lane data, so the lane cards would never
        // move during a run. Pull the latest handle (which includes per-lane
        // progress/status) and merge it. Guarded so overlapping events don't
        // stack concurrent getJobStatus calls.
        if (!refreshInFlight) {
          refreshInFlight = true
          void refreshStatus().finally(() => {
            refreshInFlight = false
          })
        }
      }),
    )

    eventCleanupFns.push(
      api.onPhaseChange((event) => {
        if (event.jobId !== jobId.value) return
        if (typeof event.phaseIndex === 'number') phaseIndex.value = event.phaseIndex
      }),
    )

    eventCleanupFns.push(
      api.onLog((line) => {
        logStore.addLog((line.level as LogLine['level']) ?? 'info', line.message)
      }),
    )

    eventCleanupFns.push(
      api.onTicket((ticket) => {
        // Captcha tickets need an interactive modal; everything (including the
        // captcha's own resolved/timeout follow-up) is also archived in the
        // attention queue for later review.
        if (ticket.kind === 'captcha') {
          captchaStore.ingest(ticket)
        }
        attentionStore.upsertTicket(ticket)
      }),
    )

    eventCleanupFns.push(
      api.onCompleted((event) => {
        if (event.jobId !== jobId.value) return
        if (event.success) {
          progress.value = 100
          // Reflect newly discovered courses back into the atlas. A scan_only
          // (or full) run rewrites output/discovered_courses_*.json; reload it
          // for every account this job touched so CourseAtlasView shows the
          // fresh list without the user re-triggering anything. Re-reading is
          // harmless for solve_only (file unchanged). Best-effort: a failed
          // reload must not break terminal handling.
          void reloadCoursesForJob()
        }
        handleTerminalStatus(event.success ? 'completed' : 'stopped')
      }),
    )

    eventCleanupFns.push(
      api.onError((event) => {
        if (event.jobId !== jobId.value) return
        error.value = event.error
        if (!event.recoverable) handleTerminalStatus('error')
      }),
    )
  }

  function toggleLaneSelection(accountId: string): void {
    const next = new Set(selectedLaneIds.value)
    if (next.has(accountId)) next.delete(accountId)
    else next.add(accountId)
    selectedLaneIds.value = next
  }

  function selectAllLanes(): void {
    selectedLaneIds.value = new Set(lanes.value.map((lane) => lane.accountId))
  }

  function deselectAllLanes(): void {
    selectedLaneIds.value = new Set()
  }

  async function startJob(payload: StartJobPayload): Promise<void> {
    status.value = 'running'
    error.value = null
    selectedLaneIds.value = new Set()
    activeElapsedBase = 0
    elapsedMs.value = 0
    startTime.value = Date.now()
    endTime.value = null
    laneElapsedMs.value = {}
    laneStartedAt.value = {}
    stopTimer()
    stopAllLaneTimers()

    try {
      const handle = await api.startJob(payload)
      jobId.value = handle.jobId
      mergeHandle(handle)
      registerEventListeners()
      startTimer()
      startAllLaneTimers()
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to start job'
      handleTerminalStatus('error')
    }
  }

  async function pauseJob(accountIds?: string[]): Promise<void> {
    if (!jobId.value) return
    try {
      await api.pauseJob(jobId.value, accountIds)
      if (accountIds?.length) {
        for (const accountId of accountIds) stopLaneTimer(accountId)
      } else {
        stopTimer()
        stopAllLaneTimers()
        status.value = 'paused'
      }
      await refreshStatus()
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to pause job'
    }
  }

  async function resumeJob(): Promise<void> {
    if (!jobId.value) return
    try {
      await api.resumeJob(jobId.value)
      startTimer()
      await refreshStatus()
      startAllLaneTimers()
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to resume job'
    }
  }

  async function resumeSelectedLanes(): Promise<void> {
    if (!jobId.value) return
    const accountIds = lanes.value
      .filter((lane) => selectedLaneIds.value.has(lane.accountId) && lane.status === 'paused')
      .map((lane) => lane.accountId)

    if (!accountIds.length) return

    try {
      await api.resumeSelected(jobId.value, accountIds)
      await refreshStatus()
      for (const accountId of accountIds) startLaneTimer(accountId)
      if (lanes.value.some((lane) => lane.status === 'running')) startTimer()
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to resume selected lanes'
    }
  }

  async function pauseSelectedLanes(): Promise<void> {
    if (!jobId.value) return
    const accountIds = lanes.value
      .filter((lane) => selectedLaneIds.value.has(lane.accountId) && lane.status === 'running')
      .map((lane) => lane.accountId)

    if (!accountIds.length) return

    try {
      await api.pauseSelected(jobId.value, accountIds)
      for (const accountId of accountIds) stopLaneTimer(accountId)
      await refreshStatus()
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to pause selected lanes'
    }
  }

  async function stopJob(accountIds?: string[]): Promise<void> {
    if (!jobId.value) return
    try {
      await api.stopJob(jobId.value, accountIds)
      await refreshStatus()
      if (!accountIds?.length) {
        selectedLaneIds.value = new Set()
        handleTerminalStatus('stopped')
      }
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to stop job'
    }
  }

  async function stopSelectedLanes(): Promise<void> {
    if (!jobId.value) return
    const accountIds = lanes.value
      .filter((lane) => selectedLaneIds.value.has(lane.accountId) && ['running', 'paused', 'pending'].includes(lane.status))
      .map((lane) => lane.accountId)

    if (!accountIds.length) return

    try {
      await api.stopSelected(jobId.value, accountIds)
      for (const accountId of accountIds) stopLaneTimer(accountId)
      await refreshStatus()
      const activeLaneExists = lanes.value.some((lane) => ['running', 'paused', 'pending'].includes(lane.status))
      if (!activeLaneExists) handleTerminalStatus('stopped')
    } catch (cause: any) {
      error.value = cause?.message ?? 'Failed to stop selected lanes'
    }
  }

  async function refreshStatus(): Promise<void> {
    if (!jobId.value) return
    const handle = await api.getJobStatus(jobId.value)
    mergeHandle(handle)
    if (handle.status === 'completed') handleTerminalStatus('completed')
    if (handle.status === 'stopped') handleTerminalStatus('stopped')
    if (handle.status === 'error') handleTerminalStatus('error')
    if (handle.status === 'running') startTimer()
    if (handle.status === 'paused') stopTimer()
    for (const lane of lanes.value) {
      if (lane.status === 'running') recomputeLaneElapsed(lane.accountId)
    }
  }

  // After a job completes, pull the freshly-persisted discovery state into the
  // course atlas. scanCourses() just re-reads discovered_courses_*.json (no
  // browser), so this is a cheap per-account file read. Each call is independent
  // and best-effort — a single account's failure is swallowed by the store.
  async function reloadCoursesForJob(): Promise<void> {
    const accountIds = [...new Set(lanes.value.map((lane) => lane.accountId))]
    if (!accountIds.length) return
    const courseStore = useCourseStore()
    await Promise.all(accountIds.map((id) => courseStore.scanCourses(id)))
  }

  function updateProgress(pct: number, idx?: number, laneUpdates?: Partial<AccountLane>[]): void {
    progress.value = pct
    if (typeof idx === 'number') phaseIndex.value = idx
    if (!laneUpdates?.length) return

    lanes.value = lanes.value.map((lane, index) => {
      const next = { ...lane, ...(laneUpdates[index] ?? {}) }
      if (lane.status !== 'running' && next.status === 'running') startLaneTimer(next.accountId)
      if (lane.status === 'running' && next.status !== 'running') stopLaneTimer(next.accountId)
      return next
    })
  }

  function reset(): void {
    unregisterEventListeners()
    stopTimer()
    stopAllLaneTimers()
    status.value = 'idle'
    jobId.value = null
    phaseIndex.value = 0
    lanes.value = []
    phases.value = []
    progress.value = 0
    error.value = null
    startTime.value = null
    endTime.value = null
    elapsedMs.value = 0
    selectedLaneIds.value = new Set()
    laneElapsedMs.value = {}
    laneStartedAt.value = {}
    activeElapsedBase = 0
    activeStartedAt = null
  }

  return {
    status,
    jobId,
    phaseIndex,
    lanes,
    phases,
    progress,
    error,
    startTime,
    endTime,
    elapsedMs,
    selectedLaneIds,
    laneElapsedMs,
    isRunning,
    isPaused,
    isIdle,
    currentPhase,
    elapsedFormatted,
    selectedLaneCount,
    allLanesSelected,
    laneElapsed,
    laneElapsedFormatted,
    toggleLaneSelection,
    selectAllLanes,
    deselectAllLanes,
    startJob,
    pauseJob,
    resumeJob,
    stopJob,
    pauseSelectedLanes,
    resumeSelectedLanes,
    stopSelectedLanes,
    refreshStatus,
    updateProgress,
    reset,
    startLaneTimer,
    stopLaneTimer,
    startAllLaneTimers,
    stopAllLaneTimers,
  }
})
