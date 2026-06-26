<template>
  <div class="settings">
    <h2 class="settings__title">系统设置</h2>
    <p class="settings__sub">配置 AI 求解器、浏览器行为、账号凭据和界面主题</p>

    <!-- ── AI Quiz Settings ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">AI 答题设置</h3>
      <div class="panel__grid">
        <!-- AI Provider -->
        <div class="field">
          <label class="field__label">AI 提供商</label>
          <select
            class="field__select"
            :value="settingsStore.settings.quizSolver"
            @change="settingsStore.updateSetting('quizSolver', ($event.target as HTMLSelectElement).value as any)"
          >
            <option value="doubao">Doubao (豆包 API)</option>
          </select>
        </div>

        <!-- Quiz Mode -->
        <div class="field">
          <label class="field__label">答题模式</label>
          <select
            class="field__select"
            :value="settingsStore.settings.maxConcurrency > 1 ? 'batch' : 'single'"
            @change="onQuizModeChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="batch">批量模式</option>
            <option value="single">逐题模式</option>
          </select>
        </div>

        <!-- Quiz Retry Count -->
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

        <!-- Target Accuracy -->
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
    </GlassmorphicPanel>

    <!-- ── Browser Settings ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">浏览器设置</h3>
      <div class="panel__grid">
        <!-- Headless -->
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

        <!-- Page Load Timeout -->
        <div class="field">
          <label class="field__label">页面加载超时 (秒)</label>
          <input
            type="number"
            class="field__input"
            :value="Math.round(settingsStore.settings.sectionDelay / 1000)"
            min="1"
            max="60"
            @change="settingsStore.updateSetting('sectionDelay', Number(($event.target as HTMLInputElement).value) * 1000)"
          />
        </div>

        <!-- Max Concurrency -->
        <div class="field">
          <label class="field__label">最大并发数</label>
          <p class="field__hint">同时运行的浏览器实例数量</p>
          <input
            type="number"
            class="field__input"
            :value="settingsStore.settings.maxConcurrency"
            min="1"
            max="8"
            @change="settingsStore.updateSetting('maxConcurrency', Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <!-- Auto Resolve Captcha -->
        <div class="field field--row">
          <div class="field__info">
            <label class="field__label">自动识别验证码</label>
            <p class="field__hint">使用 AI 自动处理滑块和图形验证码</p>
          </div>
          <Toggle
            :model-value="settingsStore.settings.autoResolveCaptcha"
            @update:model-value="settingsStore.updateSetting('autoResolveCaptcha', $event)"
          />
        </div>

        <!-- Log Retention -->
        <div class="field">
          <label class="field__label">日志保留 (天)</label>
          <input
            type="number"
            class="field__input"
            :value="settingsStore.settings.logRetention"
            min="1"
            max="30"
            @change="settingsStore.updateSetting('logRetention', Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <!-- Notifications -->
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

    <!-- ── Account Credentials ── -->
    <GlassmorphicPanel class="panel" padding="22px">
      <h3 class="panel__title">账号凭据</h3>
      <div class="creds-table" v-if="accountStore.accounts.length">
        <div class="creds-row creds-row--head">
          <span class="creds-cell">#</span>
          <span class="creds-cell">账号</span>
          <span class="creds-cell">状态</span>
          <span class="creds-cell">课程数</span>
        </div>
        <div
          v-for="(acc, i) in accountStore.accounts"
          :key="acc.id"
          class="creds-row"
        >
          <span class="creds-cell creds-cell--muted">{{ i + 1 }}</span>
          <span class="creds-cell creds-cell--mono">{{ maskPhone(acc.username) }}</span>
          <span class="creds-cell">
            <StatusDot :status="accountStatusToDot(acc.status)" size="sm" />
            <span class="creds-status-text">{{ accountStatusText(acc.status) }}</span>
          </span>
          <span class="creds-cell creds-cell--muted">{{ courseCount(acc.id) }}</span>
        </div>
      </div>
      <div v-else class="creds-empty">暂无账号数据</div>
      <p class="creds-hint">凭据由外部文件管理，请编辑 passwords/chaoxing.txt 以更新账号信息</p>
    </GlassmorphicPanel>

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
import { computed } from 'vue'
import GlassmorphicPanel from '@/shared/ui/GlassmorphicPanel.vue'
import StatusDot from '@/shared/ui/StatusDot.vue'
import Toggle from '@/shared/ui/Toggle.vue'
import PillButton from '@/shared/ui/PillButton.vue'
import { useSettingsStore } from '@/app/stores/settings.store'
import { useAccountStore } from '@/app/stores/account.store'
import { useCourseStore } from '@/app/stores/course.store'
import type { AccountStatus } from '@/shared/lib/types'

const settingsStore = useSettingsStore()
const accountStore = useAccountStore()
const courseStore = useCourseStore()

/* ── helpers ── */

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  if (phone.length <= 7) return phone.slice(0, 3) + '****'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

function accountStatusToDot(s: AccountStatus): 'online' | 'offline' | 'running' | 'idle' | 'error' | 'done' {
  if (s === 'online') return 'online'
  if (s === 'error') return 'error'
  if (s === 'checking') return 'running'
  return 'offline'
}

function accountStatusText(s: AccountStatus): string {
  if (s === 'online') return '在线'
  if (s === 'error') return '异常'
  if (s === 'checking') return '检测中'
  return '离线'
}

function courseCount(accId: string): number {
  return (courseStore.coursesByAccount[accId] ?? []).length
}

function onQuizModeChange(val: string): void {
  settingsStore.updateSetting('maxConcurrency', val === 'batch' ? 3 : 1)
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

/* ── Panel ── */
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

/* ── Field ── */
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
.field__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.field__input,
.field__select {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.field__input:focus,
.field__select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.field__input {
  max-width: 160px;
}
.field__select {
  max-width: 200px;
  cursor: pointer;
}

/* ── Credentials ── */
.creds-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.creds-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 80px;
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
  gap: 6px;
  color: var(--text);
}
.creds-cell--muted { color: var(--muted); }
.creds-cell--mono { font-family: var(--font-mono); font-size: 12px; }
.creds-status-text {
  font-size: 12px;
  color: var(--muted);
}
.creds-empty {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}
.creds-hint {
  font-size: 11px;
  color: var(--muted);
  font-style: italic;
}

/* ── Theme ── */
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.theme-switch {
  display: flex;
  gap: 8px;
}
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
  transition: background 0.15s, color 0.15s;
}
.btn-reset:hover {
  background: var(--warn-soft);
  color: var(--warn);
}

@media (max-width: 600px) {
  .panel__grid { grid-template-columns: 1fr; }
  .creds-row { grid-template-columns: 40px 1fr 1fr 60px; font-size: 12px; }
}
</style>
