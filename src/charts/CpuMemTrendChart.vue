<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { TrendPoint } from '../types/dashboard'
import { useEcharts } from './useEcharts'

const props = defineProps<{ data: TrendPoint[] }>()
const el = ref<HTMLElement | null>(null)

const { render } = useEcharts(el, () => ({
  grid: { left: 42, right: 16, top: 30, bottom: 26 },
  tooltip: {
    trigger: 'axis',
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
    data: ['集群CPU使用率', '集群内存使用率'],
  },
  xAxis: {
    type: 'category',
    data: props.data.map((d) => d.time),
    boundaryGap: false,
    axisLine: { lineStyle: { color: 'rgb(111 138 171 / 35%)' } },
    axisLabel: { color: '#6f8aab', fontSize: 10, interval: Math.max(0, Math.floor(props.data.length / 7)) },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    max: 100,
    splitLine: { lineStyle: { color: 'rgb(111 138 171 / 12%)' } },
    axisLabel: { color: '#6f8aab', fontSize: 10, formatter: '{value}%' },
  },
  series: [
    {
      name: '集群CPU使用率',
      type: 'line',
      data: props.data.map((d) => d.cpuUsage),
      showSymbol: false,
      smooth: true,
      lineStyle: { color: '#45d7ff', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgb(69 215 255 / 32%)' },
            { offset: 1, color: 'rgb(69 215 255 / 0%)' },
          ],
        },
      },
    },
    {
      name: '集群内存使用率',
      type: 'line',
      data: props.data.map((d) => d.memUsagePct),
      showSymbol: false,
      smooth: true,
      lineStyle: { color: '#8b7cff', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgb(139 124 255 / 26%)' },
            { offset: 1, color: 'rgb(139 124 255 / 0%)' },
          ],
        },
      },
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
