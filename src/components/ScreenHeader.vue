<template>
  <header class="screen-header">
    <div class="screen-header__side screen-header__side--left">
      <span class="screen-header__flare" />
      <span class="screen-header__meta">{{ dateText }}</span>
    </div>

    <div class="screen-header__center">
      <h1 class="screen-header__title">服务器运行状况监测中心</h1>
      <p class="screen-header__subtitle">SERVER HEALTH OPERATIONS CENTER · 运维实时监测大屏</p>
    </div>

    <div class="screen-header__side screen-header__side--right">
      <span class="screen-header__live" :class="{ 'screen-header__live--loading': loading }">
        <i class="screen-header__live-dot" />
        {{ loading ? '数据同步中' : 'LIVE' }} · {{ lastFetchedText }}
      </span>
      <span class="screen-header__meta">{{ clockText }}</span>
      <span class="screen-header__flare" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { formatClock, formatDate } from '../utils/format'

const props = defineProps<{ now: Date; lastFetchedAt: Date | null; loading: boolean }>()

const clockText = computed(() => formatClock(props.now))
const dateText = computed(() => formatDate(props.now))
const lastFetchedText = computed(() => (props.lastFetchedAt ? `${formatClock(props.lastFetchedAt)} 更新` : '等待接入数据库'))
</script>

<style scoped>
.screen-header {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 100%;
  padding: 0 28px;
}

.screen-header::after {
  position: absolute;
  right: 0;
  bottom: 6px;
  left: 0;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent 0%, var(--border-strong) 50%, transparent 100%);
}

.screen-header__center {
  text-align: center;
}

.screen-header__title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--text);
  text-shadow: 0 0 22px rgb(69 215 255 / 55%);
}

.screen-header__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--muted);
}

.screen-header__side {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-num);
  font-size: 16px;
  color: var(--cyan-soft);
}

.screen-header__side--left {
  justify-content: flex-start;
}

.screen-header__side--right {
  justify-content: flex-end;
}

.screen-header__flare {
  width: 90px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--cyan));
}

.screen-header__side--right .screen-header__flare {
  background: linear-gradient(90deg, var(--cyan), transparent);
}

.screen-header__live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family:
    'Segoe UI',
    'PingFang SC',
    sans-serif;
  font-size: 11px;
  color: var(--green);
  letter-spacing: 1px;
}

.screen-header__live-dot {
  width: 6px;
  height: 6px;
  background: var(--green);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--green);
  animation: live-pulse 1.6s ease-in-out infinite;
}

.screen-header__live--loading {
  color: var(--amber);
}

.screen-header__live--loading .screen-header__live-dot {
  background: var(--amber);
  box-shadow: 0 0 8px var(--amber);
}

@keyframes live-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>
