<template>
  <ul class="alert-feed">
    <li v-for="alert in alerts" :key="alert.id" class="alert-feed__item" :class="`alert-feed__item--${alert.level}`">
      <span class="alert-feed__time">{{ shortTime(alert.time) }}</span>
      <span class="alert-feed__dot" />
      <span class="alert-feed__room">{{ alert.room }}</span>
      <span class="alert-feed__msg">{{ alert.message }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { AlertItem } from '../types/dashboard'

defineProps<{ alerts: AlertItem[] }>()

function shortTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.alert-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.alert-feed__item {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 84px 8px 52px 1fr;
  gap: 10px;
  align-items: center;
  padding: 7px 4px;
  font-size: 12px;
  border-bottom: 1px solid rgb(69 215 255 / 8%);
}

.alert-feed__time {
  font-family: var(--font-num);
  color: var(--muted);
}

.alert-feed__dot {
  width: 7px;
  height: 7px;
  background: var(--amber);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--amber);
}

.alert-feed__room {
  color: var(--cyan-soft);
}

.alert-feed__msg {
  overflow: hidden;
  color: #cfe9f7;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-feed__item--danger .alert-feed__dot {
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
}

.alert-feed__item--danger .alert-feed__msg {
  color: #ffd1d6;
}
</style>
