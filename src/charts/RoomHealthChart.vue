<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { RoomHealth } from '../types/dashboard'
import { useEcharts } from './useEcharts'

const props = defineProps<{ data: RoomHealth[] }>()
const el = ref<HTMLElement | null>(null)

const { render } = useEcharts(el, () => ({
  grid: { left: 54, right: 20, top: 26, bottom: 8 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    backgroundColor: 'rgb(6 16 29 / 92%)',
    borderColor: 'rgb(69 215 255 / 30%)',
    textStyle: { color: '#e8f4ff', fontSize: 12 },
  },
  legend: {
    top: 0,
    right: 4,
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { color: '#6f8aab', fontSize: 11 },
    data: ['健康', '预警', '严重'],
  },
  xAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgb(111 138 171 / 12%)' } },
    axisLabel: { color: '#6f8aab', fontSize: 10 },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: props.data.map((d) => d.room),
    axisLine: { lineStyle: { color: 'rgb(111 138 171 / 35%)' } },
    axisLabel: { color: '#cfe9f7', fontSize: 12 },
  },
  series: [
    {
      name: '健康',
      type: 'bar',
      stack: 'total',
      barWidth: 14,
      data: props.data.map((d) => d.healthy),
      itemStyle: { color: '#35e08c' },
    },
    {
      name: '预警',
      type: 'bar',
      stack: 'total',
      data: props.data.map((d) => d.warning),
      itemStyle: { color: '#ffb020' },
    },
    {
      name: '严重',
      type: 'bar',
      stack: 'total',
      data: props.data.map((d) => d.danger),
      itemStyle: { color: '#ff4d5e' },
    },
  ],
}))

watch(() => props.data, render)
</script>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
