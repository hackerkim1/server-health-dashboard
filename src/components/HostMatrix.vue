<template>
  <div class="host-matrix">
    <div v-for="group in groups" :key="group.room" class="host-matrix__group">
      <div class="host-matrix__group-head">
        <span>{{ group.room }}</span>
        <span class="host-matrix__group-count">{{ group.hosts.length }} 台</span>
      </div>
      <div class="host-matrix__cells">
        <div
          v-for="host in group.hosts"
          :key="host.hostid"
          class="host-matrix__cell"
          :class="`host-matrix__cell--${host.status}`"
          @mouseenter="hovered = host"
          @mouseleave="hovered = null"
        >
          {{ host.hostid.replace('host', '') }}
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="hovered" class="host-matrix__tooltip">
        <div class="host-matrix__tooltip-title">
          {{ hovered.hostname }}
          <span :class="`host-matrix__badge host-matrix__badge--${hovered.status}`">{{ statusText[hovered.status] }}</span>
        </div>
        <div class="host-matrix__tooltip-grid">
          <span>机型</span><span>{{ hovered.model }}</span>
          <span>机房/机柜</span><span>{{ hovered.room }} · {{ hovered.rack }}</span>
          <span>负责人</span><span>{{ hovered.owner }}</span>
          <span>CPU 使用率</span><span>{{ hovered.cpuUsage }}%</span>
          <span>内存使用率</span><span>{{ hovered.memUsagePct }}%</span>
          <span>磁盘利用率</span><span>{{ hovered.diskUtilAvg }}%</span>
          <span>风险评分</span><span>{{ hovered.riskScore }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { HostRecord, StatusLevel } from '../types/dashboard'

const props = defineProps<{ hosts: HostRecord[] }>()
const hovered = ref<HostRecord | null>(null)

const statusText: Record<StatusLevel, string> = { good: '健康', warning: '预警', danger: '严重' }

const groups = computed(() => {
  const map = new Map<string, HostRecord[]>()
  for (const h of props.hosts) {
    const arr = map.get(h.room) ?? []
    arr.push(h)
    map.set(h.room, arr)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([room, hosts]) => ({ room, hosts: hosts.sort((a, b) => a.hostid.localeCompare(b.hostid)) }))
})
</script>

<style scoped>
.host-matrix {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-content: flex-start;
  height: 100%;
  padding-top: 4px;
}

.host-matrix__group {
  padding: 10px 12px;
  background: rgb(11 28 48 / 55%);
  border: 1px solid rgb(69 215 255 / 14%);
  border-radius: 6px;
}

.host-matrix__group-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--cyan-soft);
  letter-spacing: 1px;
}

.host-matrix__group-count {
  color: var(--muted);
}

.host-matrix__cells {
  display: grid;
  grid-template-columns: repeat(4, 32px);
  gap: 6px;
}

.host-matrix__cell {
  display: grid;
  place-items: center;
  height: 32px;
  font-family: var(--font-num);
  font-size: 12px;
  color: #06101d;
  cursor: default;
  background: var(--green);
  border-radius: 4px;
  box-shadow: 0 0 8px rgb(53 224 140 / 45%);
  transition: transform 0.15s ease;
}

.host-matrix__cell:hover {
  z-index: 1;
  transform: scale(1.12);
}

.host-matrix__cell--warning {
  background: var(--amber);
  box-shadow: 0 0 8px rgb(255 176 32 / 55%);
}

.host-matrix__cell--danger {
  color: #fff;
  background: var(--red);
  box-shadow: 0 0 10px rgb(255 77 94 / 65%);
  animation: cell-pulse 1.6s ease-in-out infinite;
}

@keyframes cell-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

.host-matrix__tooltip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  width: 230px;
  padding: 12px 14px;
  background: rgb(6 16 29 / 96%);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 45%);
}

.host-matrix__tooltip-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.host-matrix__badge {
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 400;
  border-radius: 10px;
}

.host-matrix__badge--good {
  color: var(--green);
  background: rgb(53 224 140 / 15%);
}

.host-matrix__badge--warning {
  color: var(--amber);
  background: rgb(255 176 32 / 15%);
}

.host-matrix__badge--danger {
  color: var(--red);
  background: rgb(255 77 94 / 15%);
}

.host-matrix__tooltip-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  row-gap: 5px;
  column-gap: 10px;
  font-size: 12px;
}

.host-matrix__tooltip-grid span:nth-child(odd) {
  color: var(--muted);
}

.host-matrix__tooltip-grid span:nth-child(even) {
  color: var(--cyan-soft);
  text-align: right;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
