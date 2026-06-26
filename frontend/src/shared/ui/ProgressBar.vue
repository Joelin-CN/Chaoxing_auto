<template>
  <div class="progress-bar-track" :style="{ height }">
    <div
      class="progress-bar-fill"
      :class="`progress-bar-fill--${variant}`"
      :style="{ width: clampedPercent + '%' }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  percent: number
  variant?: 'accent' | 'ok' | 'warn' | 'gold'
  height?: string
}>(), {
  variant: 'accent',
  height: '8px',
})

const clampedPercent = computed(() => Math.max(0, Math.min(100, props.percent)))
</script>

<style scoped>
.progress-bar-track {
  width: 100%;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  background: var(--accent);
}

.progress-bar-fill--accent { background: var(--accent); }
.progress-bar-fill--ok     { background: var(--ok); }
.progress-bar-fill--warn   { background: var(--warn); }
.progress-bar-fill--gold   { background: var(--gold); }
</style>
