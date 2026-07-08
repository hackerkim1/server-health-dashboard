import { onBeforeUnmount, onMounted, type Ref, ref } from 'vue'

const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080

export function useAutoScale(target: Ref<HTMLElement | null>) {
  const scale = ref(1)
  let observer: ResizeObserver | null = null

  function updateScale() {
    const parent = target.value?.parentElement
    const vw = parent?.clientWidth || window.innerWidth
    const vh = parent?.clientHeight || window.innerHeight
    scale.value = Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT)
  }

  onMounted(() => {
    updateScale()
    window.addEventListener('resize', updateScale)
    const parent = target.value?.parentElement
    if (parent) {
      observer = new ResizeObserver(updateScale)
      observer.observe(parent)
    }
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScale)
    observer?.disconnect()
  })

  return { scale, updateScale, STAGE_WIDTH, STAGE_HEIGHT }
}
