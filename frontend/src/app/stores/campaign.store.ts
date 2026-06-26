import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ObjectiveType,
  StrategyType,
  ModeType,
  CampaignForecast,
} from '@/shared/lib/types'
import { DEFAULT_FORECAST } from '@/shared/lib/constants'

export const useCampaignStore = defineStore('campaign', () => {
  const objective = ref<ObjectiveType>('catchup')
  const strategy = ref<StrategyType>('balanced')
  const mode = ref<ModeType>('full-auto')
  const selectedCourseIds = ref<string[]>([])
  const selectedOperatorIds = ref<string[]>([])
  const options = ref<Record<string, unknown>>({})

  /* computed */

  const forecast = computed<CampaignForecast>(() => {
    const base = DEFAULT_FORECAST[objective.value]

    // Adjust forecast based on course count
    const courseCount = selectedCourseIds.value.length || 1
    const operatorCount = selectedOperatorIds.value.length || 1

    const concurrencyFactor = Math.max(0.3, 1 / Math.sqrt(operatorCount))
    const adjustedMinutes = Math.round(
      base.estimatedFinishMinutes * courseCount * concurrencyFactor,
    )
    const adjustedCompletions = Math.round(
      base.projectedCompletions * courseCount,
    )

    return {
      estimatedFinishMinutes: adjustedMinutes,
      projectedCompletions: adjustedCompletions,
      riskLevel: base.riskLevel,
      confidencePercent: Math.max(
        10,
        base.confidencePercent - (courseCount > 5 ? 15 : 0),
      ),
      attentionCount: base.attentionCount + (courseCount > 10 ? 2 : 0),
    }
  })

  const isValid = computed(() =>
    selectedCourseIds.value.length > 0 &&
    selectedOperatorIds.value.length > 0
  )

  /* actions */

  function setObjective(val: ObjectiveType): void {
    objective.value = val
  }

  function setStrategy(val: StrategyType): void {
    strategy.value = val
  }

  function setMode(val: ModeType): void {
    mode.value = val
  }

  function setSelectedCourses(ids: string[]): void {
    selectedCourseIds.value = ids
  }

  function setSelectedOperators(ids: string[]): void {
    selectedOperatorIds.value = ids
  }

  function syncSelection(input: { courseIds: string[]; operatorIds: string[] }): void {
    selectedCourseIds.value = [...input.courseIds]
    selectedOperatorIds.value = [...input.operatorIds]
  }

  function setOption(key: string, value: unknown): void {
    options.value = { ...options.value, [key]: value }
  }

  function resetCampaign(): void {
    objective.value = 'catchup'
    strategy.value = 'balanced'
    mode.value = 'full-auto'
    selectedCourseIds.value = []
    selectedOperatorIds.value = []
    options.value = {}
  }

  return {
    objective,
    strategy,
    mode,
    selectedCourseIds,
    selectedOperatorIds,
    options,
    forecast,
    isValid,
    setObjective,
    setStrategy,
    setMode,
    setSelectedCourses,
    setSelectedOperators,
    syncSelection,
    setOption,
    resetCampaign,
  }
})
