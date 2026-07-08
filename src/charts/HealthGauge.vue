<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { useEcharts } from './useEcharts'

const props = defineProps<{ score: number }>()
const el = ref<HTMLElement | null>(null)

const { render } = useEcharts(el, () => ({
  series: [
    {
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      radius: '92%',
      center: ['50%', '58%'],
      progress: { show: true, width: 10, itemStyle: { color: '#45d7ff' } },
      axisLine: { lineStyle: { width: 10, color: [[1, 'rgb(111 138 171 / 16%)']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: '#8be8ff',
        fontSize: 26,
        fontWeight: 700,
        offsetCenter: [0, 4],
      },
      title: {
        show: true,
        offsetCenter: [0, 34],
        color: '#6f8aab',
        fontSize: 11,
      },
      data: [{ value: props.score, name: '集群健康度' }],
    },
  ],
}))

watch(() => props.score, render)
</script>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
