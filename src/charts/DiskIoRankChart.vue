<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { DiskIoRankItem } from '../types/dashboard'
import { useEcharts } from './useEcharts'

const props = defineProps<{ data: DiskIoRankItem[] }>()
const el = ref<HTMLElement | null>(null)

const { render } = useEcharts(el, () => {
  const sorted = [...props.data].sort((a, b) => a.totalMBs - b.totalMBs)
  return {
    grid: { left: 66, right: 20, top: 26, bottom: 8 },
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
      data: ['读吞吐', '写吞吐'],
    },
    xAxis: {
      type: 'value',
      name: 'MB/s',
      nameTextStyle: { color: '#6f8aab', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgb(111 138 171 / 12%)' } },
      axisLabel: { color: '#6f8aab', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.hostid),
      axisLine: { lineStyle: { color: 'rgb(111 138 171 / 35%)' } },
      axisLabel: { color: '#cfe9f7', fontSize: 11 },
    },
    series: [
      {
        name: '读吞吐',
        type: 'bar',
        stack: 'io',
        barWidth: 12,
        data: sorted.map((d) => d.readMBs),
        itemStyle: { color: '#45d7ff' },
      },
      {
        name: '写吞吐',
        type: 'bar',
        stack: 'io',
        data: sorted.map((d) => d.writeMBs),
        itemStyle: { color: '#ff8a45' },
      },
    ],
  }
})

watch(() => props.data, render)
</script>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
