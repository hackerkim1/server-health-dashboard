<template>
  <div class="metric-card" :class="`metric-card--${status}`">
    <div class="metric-card__label">{{ label }}</div>
    <div class="metric-card__value">
      <span class="metric-card__num">{{ value }}</span>
      <span class="metric-card__unit">{{ unit }}</span>
    </div>
    <div class="metric-card__desc">{{ desc }}</div>
    <span class="metric-card__dot" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    status?: 'good' | 'warning' | 'danger' | 'neutral'
    desc?: string
  }>(),
  { unit: '', status: 'neutral', desc: '' },
)
</script>

<style scoped>
.metric-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 12px 18px;
  overflow: hidden;
  background: linear-gradient(135deg, rgb(11 28 48 / 90%) 0%, rgb(6 16 29 / 90%) 100%);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.metric-card__label {
  font-size: 13px;
  color: var(--muted);
}

.metric-card__value {
  margin-top: 6px;
}

.metric-card__num {
  font-family: var(--font-num);
  font-size: 30px;
  font-weight: 700;
  color: var(--cyan-soft);
  text-shadow: 0 0 16px rgb(69 215 255 / 45%);
}

.metric-card__unit {
  margin-left: 4px;
  font-size: 13px;
  color: var(--muted);
}

.metric-card__desc {
  margin-top: 4px;
  font-size: 11px;
  color: var(--muted);
}

.metric-card__dot {
  position: absolute;
  top: 14px;
  right: 16px;
  width: 8px;
  height: 8px;
  background: var(--cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--cyan);
}

.metric-card--good .metric-card__num {
  color: var(--green);
  text-shadow: 0 0 16px rgb(53 224 140 / 45%);
}

.metric-card--good .metric-card__dot {
  background: var(--green);
  box-shadow: 0 0 10px var(--green);
}

.metric-card--warning .metric-card__num {
  color: var(--amber);
  text-shadow: 0 0 16px rgb(255 176 32 / 45%);
}

.metric-card--warning .metric-card__dot {
  background: var(--amber);
  box-shadow: 0 0 10px var(--amber);
}

.metric-card--danger .metric-card__num {
  color: var(--red);
  text-shadow: 0 0 16px rgb(255 77 94 / 45%);
}

.metric-card--danger .metric-card__dot {
  background: var(--red);
  box-shadow: 0 0 10px var(--red);
  animation: pulse-dot 1.6s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>
