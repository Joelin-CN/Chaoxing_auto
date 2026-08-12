<template>
  <div class="settings">
    <h2 class="settings__title">系统设置</h2>
    <p class="settings__sub">配置 AI 推理、账号、运行预算与界面主题</p>

    <!-- ── AI 推理 · 火山方舟 ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">AI 推理 · 火山方舟</h3>
      <div class="ai-status">
        <Chip :variant="aiStatus.configured ? 'ok' : 'warn'" size="md">
          {{ aiStatus.configured ? `已配置 ${aiStatus.keyTail}` : '未配置' }}
        </Chip>
        <span class="ai-model">模型 {{ aiStatus.model || '—' }}</span>
      </div>
      <div class="panel__grid">
        <div class="field">
          <label class="field__label">API Key</label>
          <p class="field__hint">火山方舟 ARK API Key（ark- 开头）</p>
          <MaskedInput
            v-model="aiKey"
            :placeholder="aiStatus.configured ? '已配置，留空保持不变' : 'ark-…'"
          />
        </div>
        <div class="field">
          <label class="field__label">模型 ID</label>
          <p class="field__hint">方舟接入点 ID（ep- 或模型名）</p>
          <input
            v-model="aiModel"
            type="text"
            class="field__input"
            placeholder="ep-…"
          />
        </div>
        <div class="field">
          <label class="field__label">答题重试次数</label>
          <input
            type="number"
            class="field__input"
            :value="settingsStore.settings.quizRetryCount"
            min="0"
            max="10"
            @change="settingsStore.updateSetting('quizRetryCount', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field">
          <label class="field__label">目标正确率 (%)</label>
          <input
            type="number"
            class="field__input"
            :value="settingsStore.settings.targetAccuracy"
            min="60"
            max="100"
            @change="settingsStore.updateSetting('targetAccuracy', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
      <div class="panel__actions">
        <button class="btn-primary" :disabled="busy" @click="saveAi">
          {{ aiSaving ? '保存中…' : '保存并写入本地文件' }}
        </button>
        <button class="btn-ghost" :disabled="busy" @click="testAi">
          {{ aiTesting ? '测试中…' : '测试连通性' }}
        </button>
        <span class="ai-result" :class="{ 'ai-result--ok': aiTestOk }">{{ aiTestMsg }}</span>
      </div>
    </GlassmorphicPanel>

    <!-- ── 账号管理 ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">账号管理</h3>
      <FilePickerField
        v-model="accountsFilePath"
        label="当前账号文件"
      />
      <p v-if="accountsError" class="field__error">{{ accountsError }}</p>
      <div v-if="accountStore.accounts.length" class="creds-table">
        <div class="creds-row creds-row--head">
          <span class="creds-cell">#</span>
          <span class="creds-cell">账号</span>
          <span class="creds-cell">登录网址</span>
          <span class="creds-cell">操作</span>
        </div>
        <div v-for="(acc, i) in accountStore.accounts" :key="acc.id" class="creds-row">
          <span class="creds-cell creds-cell--muted">{{ i + 1 }}</span>
          <span class="creds-cell creds-cell--mono">{{ maskPhone(acc.username) }}</span>
          <span class="creds-cell creds-cell--muted">默认</span>
          <span class="creds-cell">
            <button class="btn-link" :disabled="busy" @click="openEdit(acc)">编辑</button>
            <button class="btn-link btn-link--danger" :disabled="busy" @click="askDelete(acc)">
              删除
            </button>
          </span>
        </div>
      </div>
      <div v-else class="creds-empty">添加第一个账号</div>
      <div class="panel__actions">
        <button class="btn-primary" :disabled="busy" @click="openAdd">添加账号</button>
        <span class="field__hint">任务运行中不可修改账号</span>
      </div>
    </GlassmorphicPanel>

    <!-- ── 运行与内存 ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">运行与内存</h3>
      <BudgetGauge
        :plan="memoryStore.plan"
        :project-chrome-gb="memoryStore.latest?.projectChromeGB ?? 0"
        :remaining-count="memoryStore.latest?.remainingCount ?? null"
        :mock="mockMode"
      />
      <div class="panel__grid">
        <div class="field">
          <label class="field__label">目标并发</label>
          <p class="field__hint">自动上限 {{ planMax }}（内存与 CPU 取较小值）</p>
          <input
            type="range"
            min="1"
            :max="planMax"
            :value="concurrencyTarget ?? planMax"
            class="field__range"
            @input="setConcurrency(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="field__hint">当前：{{ concurrencyTarget ?? '自动（上限）' }}</span>
        </div>
        <div class="field">
          <label class="field__label">单实例估算 (GB)</label>
          <p class="field__hint">实测约 0.5–0.55，默认 0.7 留余量</p>
          <input
            type="number"
            class="field__input"
            :value="settingsStore.settings.perAccountEstimateGB"
            min="0.3"
            max="4"
            step="0.1"
            @change="settingsStore.updateSetting('perAccountEstimateGB', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field field--row">
          <div class="field__info">
            <label class="field__label">无头模式</label>
            <p class="field__hint">浏览器在后台运行，不显示窗口</p>
          </div>
          <Toggle
            :model-value="settingsStore.settings.headless"
            @update:model-value="settingsStore.updateSetting('headless', $event)"
          />
        </div>
        <div class="field field--row">
          <div class="field__info">
            <label class="field__label">系统通知</label>
            <p class="field__hint">任务完成或异常时推送桌面通知</p>
          </div>
          <Toggle
            :model-value="settingsStore.settings.notifications"
            @update:model-value="settingsStore.updateSetting('notifications', $event)"
          />
        </div>
      </div>
    </GlassmorphicPanel>

    <!-- ── 账号编辑弹窗 ── -->
    <GlassmorphicPanel v-if="editing" class="panel dialog-inline" padding="22px">
      <h3 class="panel__title">{{ editing.id !== null ? '编辑账号' : '添加账号' }}</h3>
      <div class="panel__grid">
        <div class="field">
          <label class="field__label">账号</label>
          <input v-model="form.account" type="text" class="field__input" :disabled="editing.id !== null" />
        </div>
        <div class="field">
          <label class="field__label">密码</label>
          <MaskedInput v-model="form.password" placeholder="请输入密码" />
        </div>
        <div class="field">
          <label class="field__label">登录网址（可选）</label>
          <input v-model="form.website" type="text" class="field__input" placeholder="留空使用默认登录页" />
        </div>
      </div>
      <div class="panel__actions">
        <button class="btn-primary" :disabled="busy" @click="submitAccount">保存</button>
        <button class="btn-ghost" @click="closeEdit">取消</button>
        <span class="field__error">{{ formError }}</span>
      </div>
    </GlassmorphicPanel>

    <ConfirmDialog
      :open="deleting !== null"
      title="删除账号"
      :message="`确定删除账号 ${deleting ? maskPhone(deleting.username) : ''}？登录档案目录不会被删除。`"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />

    <!-- ── Theme ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">界面主题</h3>
      <div class="theme-row">
        <div class="field__info">
          <label class="field__label">主题模式</label>
          <p class="field__hint">切换浅色 / 深色界面风格</p>
        </div>
        <div class="theme-switch">
          <PillButton
            :active="settingsStore.settings.theme === 'light'"
            variant="default"
            @click="settingsStore.setTheme('light')"
          >☀️ 浅色</PillButton>
          <PillButton
            :active="settingsStore.settings.theme === 'dark'"
            variant="default"
            @click="settingsStore.setTheme('dark')"
          >🌙 深色</PillButton>
        </div>
      </div>
      <button class="btn-reset" @click="settingsStore.resetSettings()">恢复默认设置</button>
    </GlassmorphicPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import GlassmorphicPanel from '@/shared/ui/GlassmorphicPanel.vue'
import StatusDot from '@/shared/ui/StatusDot.vue'
import Toggle from '@/shared/ui/Toggle.vue'
import PillButton from '@/shared/ui/PillButton.vue'
import Chip from '@/shared/ui/Chip.vue'
import MaskedInput from '@/shared/ui/MaskedInput.vue'
import BudgetGauge from '@/shared/ui/BudgetGauge.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import FilePickerField from '@/shared/ui/FilePickerField.vue'
import { useSettingsStore } from '@/app/stores/settings.store'
import { useAccountStore } from '@/app/stores/account.store'
import { useMemoryStore } from '@/app/stores/memory.store'
import { useExecutionStore } from '@/app/stores/execution.store'
import { createApiClient, isMockMode } from '@/shared/lib/apiClient'
import type { Account } from '@/shared/lib/types'

const settingsStore = useSettingsStore()
const accountStore = useAccountStore()
const memoryStore = useMemoryStore()
const executionStore = useExecutionStore()
const api = createApiClient()

const mockMode = isMockMode()
const busy = computed(() => executionStore.isRunning)

const aiStatus = ref<{ configured: boolean; model: string; keyTail: string }>({
  configured: false, model: '', keyTail: '',
})
const aiKey = ref('')
const aiModel = ref('')
const aiSaving = ref(false)
const aiTesting = ref(false)
const aiTestMsg = ref('')
const aiTestOk = ref(false)

const accountsFilePath = ref(settingsStore.settings.accountsFilePath)
const accountsError = ref('')

const editing = ref<{ id: number | null } | null>(null)
const deleting = ref<Account | null>(null)
const form = ref({ account: '', password: '', website: '' })
const formError = ref('')

const planMax = computed(() => memoryStore.plan?.maxConcurrent ?? 8)
const concurrencyTarget = computed(() => settingsStore.settings.concurrencyTarget)

watch(accountsFilePath, (val) => {
  settingsStore.updateSetting('accountsFilePath', val)
  reloadAccounts()
})

onMounted(async () => {
  try {
    aiStatus.value = await api.getAiStatus()
    aiModel.value = aiStatus.value.model
  } catch { /* backend unavailable */ }
  reloadAccounts()
})

async function reloadAccounts(): Promise<void> {
  accountsError.value = ''
  try {
    await accountStore.fetchAccounts()
  } catch (e: any) {
    accountsError.value = e?.message ?? '账号文件解析失败'
  }
}

async function saveAi(): Promise<void> {
  aiSaving.value = true
  aiTestMsg.value = ''
  try {
    await api.setAiConfig({ apiKey: aiKey.value, model: aiModel.value })
    aiTestMsg.value = '已保存'
    aiTestOk.value = true
    aiKey.value = ''
    aiStatus.value = await api.getAiStatus()
  } catch (e: any) {
    aiTestMsg.value = e?.message ?? '保存失败'
    aiTestOk.value = false
  } finally {
    aiSaving.value = false
  }
}

async function testAi(): Promise<void> {
  aiTesting.value = true
  aiTestMsg.value = ''
  try {
    const r = await api.testAi()
    aiTestOk.value = r.ok
    aiTestMsg.value = r.ok ? '连通性正常' : (r.reason ?? '连接失败')
  } catch (e: any) {
    aiTestOk.value = false
    aiTestMsg.value = e?.message ?? '连接失败'
  } finally {
    aiTesting.value = false
  }
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  if (phone.length <= 7) return phone.slice(0, 3) + '****'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

function openAdd(): void {
  editing.value = { id: null }
  form.value = { account: '', password: '', website: '' }
  formError.value = ''
}

function openEdit(acc: Account): void {
  editing.value = { id: Number(acc.id) }
  form.value = { account: acc.username, password: '', website: '' }
  formError.value = ''
}

function closeEdit(): void {
  editing.value = null
}

function askDelete(acc: Account): void {
  deleting.value = acc
}

async function submitAccount(): Promise<void> {
  formError.value = ''
  try {
    if (editing.value?.id === null) {
      if (!form.value.account.trim() || !form.value.password) {
        formError.value = '账号与密码不能为空。'
        return
      }
      await accountStore.addAccount({
        account: form.value.account.trim(),
        password: form.value.password,
        website: form.value.website.trim() || undefined,
      })
    } else if (editing.value) {
      await accountStore.editAccount({
        index: editing.value.id,
        password: form.value.password || undefined,
        website: form.value.website.trim() || undefined,
      })
    }
    closeEdit()
    await reloadAccounts()
  } catch (e: any) {
    formError.value = e?.message ?? '保存失败'
  }
}

async function confirmDelete(): Promise<void> {
  if (deleting.value === null) return
  try {
    await accountStore.removeAccount(Number(deleting.value.id))
  } catch (e: any) {
    accountsError.value = e?.message ?? '删除失败'
  }
  deleting.value = null
  await reloadAccounts()
}

function setConcurrency(value: number): void {
  settingsStore.updateSetting('concurrencyTarget', value)
}
</script>

<style scoped>
.settings {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}
.settings__title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}
.settings__sub {
  font-size: 14px;
  color: var(--muted);
  margin-top: -12px;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel__title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.panel__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-status {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-model {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.ai-result { font-size: 12px; color: var(--warn); }
.ai-result--ok { color: var(--ok); }
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.field__hint {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}
.field__error {
  font-size: 12px;
  color: var(--warn);
}
.field__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.field__input {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  outline: none;
  max-width: 320px;
}
.field__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.field__range {
  width: 100%;
  max-width: 320px;
}
.btn-primary,
.btn-ghost {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: 13px;
  cursor: pointer;
}
.btn-primary {
  border: none;
  background: var(--accent);
  color: #fff;
}
.btn-primary:disabled,
.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}
.creds-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.creds-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 140px;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.creds-row--head {
  font-weight: 700;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--line);
  margin-bottom: 2px;
}
.creds-row:not(.creds-row--head):hover {
  background: var(--accent-soft);
}
.creds-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}
.creds-cell--muted { color: var(--muted); }
.creds-cell--mono { font-family: var(--font-mono); font-size: 12px; }
.creds-empty {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}
.btn-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.btn-link--danger { color: var(--warn); }
.btn-reset {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 12px;
  cursor: pointer;
}
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.theme-switch {
  display: flex;
  gap: 8px;
}
.dialog-inline {
  border-color: var(--accent-soft);
}
@media (max-width: 600px) {
  .panel__grid { grid-template-columns: 1fr; }
  .creds-row { grid-template-columns: 40px 1fr 1fr 80px; font-size: 12px; }
}
</style>
