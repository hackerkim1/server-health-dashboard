<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { RiskRankItem } from '../types/dashboard'
import { useEcharts } from './useEcharts'

const props = defineProps<{ data: RiskRankItem[] }>()
const el = ref<HTMLElement | null>(null)

const levelColor: Record<string, string> = {
  good: '#35e08c',
  warning: '#ffb020',
  danger: '#ff4d5e',
}

const { render } = useEcharts(el, () => {
  const sorted = [...props.data].sort((a, b) => a.riskScore - b.riskScore)
  return {
    grid: { left: 66, right: 30, top: 6, bottom: 6 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgb(6 16 29 / 92%)',
      borderColor: 'rgb(69 215 255 / 30%)',
      textStyle: { color: '#e8f4ff', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = (params as { dataIndex: number }[])[0]
        const item = sorted[p.dataIndex]
        return `${item.hostname}<br/>风险评分：${item.riskScore}<br/>CPU：${item.cpuUsage}% 内存：${item.memUsagePct}%`
      },
    },
    xAxis: {
      type: 'value',
      max: 100,
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
        type: 'bar',
        barWidth: 10,
        data: sorted.map((d) => ({ value: d.riskScore, itemStyle: { color: levelColor[d.riskLevel] } })),
        label: {
          show: true,
          position: 'right',
          color: '#cfe9f7',
          fontSize: 11,
        },
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
