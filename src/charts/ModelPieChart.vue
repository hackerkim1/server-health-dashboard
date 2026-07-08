<template>
  <div ref="el" class="chart" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ModelDistribution } from '../types/dashboard'
import { useEcharts } from './useEcharts'

const props = defineProps<{ data: ModelDistribution[] }>()
const el = ref<HTMLElement | null>(null)

const palette = ['#45d7ff', '#8b7cff', '#35e08c', '#ffb020', '#2f7cff', '#ff4d5e']

const { render } = useEcharts(el, () => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgb(6 16 29 / 92%)',
    borderColor: 'rgb(69 215 255 / 30%)',
    textStyle: { color: '#e8f4ff', fontSize: 12 },
  },
  legend: {
    orient: 'vertical',
    right: 4,
    top: 'middle',
    itemWidth: 8,
    itemHeight: 8,
    textStyle: { color: '#a8bfd8', fontSize: 11 },
  },
  series: [
    {
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['36%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      itemStyle: {
        borderColor: '#06101d',
        borderWidth: 2,
      },
      data: props.data.map((d, i) => ({
        name: d.model,
        value: d.count,
        itemStyle: { color: palette[i % palette.length] },
      })),
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
