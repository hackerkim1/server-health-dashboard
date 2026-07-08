import * as echarts from 'echarts'
import { type Ref, onBeforeUnmount, onMounted } from 'vue'

export function useEcharts(el: Ref<HTMLElement | null>, buildOption: () => echarts.EChartsOption) {
  let chart: echarts.ECharts | null = null
  let observer: ResizeObserver | null = null

  function render() {
    if (!chart) return
    chart.setOption(buildOption(), true)
  }

  onMounted(() => {
    if (!el.value) return
    chart = echarts.init(el.value)
    render()
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(el.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.dispose()
    chart = null
  })

  return { render }
}
