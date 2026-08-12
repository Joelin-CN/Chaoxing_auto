import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Account } from '@/shared/lib/types'
import { createApiClient } from '@/shared/lib/apiClient'

const api = createApiClient()

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const selectedAccountIds = ref<Set<string>>(new Set())
  const error = ref<string | null>(null)
  let pendingFetch: Promise<void> | null = null

  /* computed */

  const onlineAccounts = computed(() =>
    accounts.value.filter((a) => a.status === 'online'),
  )

  const accountCount = computed(() => accounts.value.length)

  const selectedAccounts = computed(() =>
    accounts.value.filter((a) => selectedAccountIds.value.has(a.id)),
  )

  const hasSelection = computed(() => selectedAccountIds.value.size > 0)

  /* actions */

  async function fetchAccounts(): Promise<void> {
    if (loading.value && pendingFetch) return pendingFetch
    if (loaded.value) return

    loading.value = true
    error.value = null
    pendingFetch = (async () => {
      try {
        accounts.value = await api.getAccounts()
        loaded.value = true
      } catch (e: any) {
        error.value = e?.message ?? 'Failed to fetch accounts'
      } finally {
        loading.value = false
        pendingFetch = null
      }
    })()
    return pendingFetch
  }

  async function refreshAccountStatus(accountId: string): Promise<void> {
    try {
      const updated = await api.getAccountStatus(accountId)
      const idx = accounts.value.findIndex((a) => a.id === accountId)
      if (idx !== -1) accounts.value[idx] = updated
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to refresh account status'
    }
  }

  async function addAccount(payload: { account: string; password: string; website?: string }): Promise<void> {
    await api.addAccount(payload)
    await fetchAccounts()
  }

  async function editAccount(payload: { index: number; password?: string; website?: string }): Promise<void> {
    await api.editAccount(payload)
    await fetchAccounts()
  }

  async function removeAccount(index: number): Promise<void> {
    await api.removeAccount(index)
    await fetchAccounts()
  }

  function toggleAccountSelection(accountId: string): void {
    const set = new Set(selectedAccountIds.value)
    if (set.has(accountId)) {
      set.delete(accountId)
    } else {
      set.add(accountId)
    }
    selectedAccountIds.value = set
  }

  function selectAccount(accountId: string): void {
    selectedAccountIds.value = new Set([...selectedAccountIds.value, accountId])
  }

  function deselectAccount(accountId: string): void {
    const set = new Set(selectedAccountIds.value)
    set.delete(accountId)
    selectedAccountIds.value = set
  }

  function selectAll(): void {
    selectedAccountIds.value = new Set(accounts.value.map((a) => a.id))
  }

  function deselectAll(): void {
    selectedAccountIds.value = new Set()
  }

  return {
    accounts,
    loading,
    loaded,
    error,
    selectedAccountIds,
    onlineAccounts,
    accountCount,
    selectedAccounts,
    hasSelection,
    fetchAccounts,
    refreshAccountStatus,
    addAccount,
    editAccount,
    removeAccount,
    toggleAccountSelection,
    selectAccount,
    deselectAccount,
    selectAll,
    deselectAll,
  }
})
