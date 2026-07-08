<template>
  <div class="stage-viewport">
    <div ref="stageRef" class="stage" :style="{ transform: `translate(-50%, -50%) scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useAutoScale } from '../utils/useAutoScale'

const stageRef = ref<HTMLElement | null>(null)
const { scale } = useAutoScale(stageRef)
</script>

<style scoped>
.stage-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% -10%, rgb(46 122 189 / 22%) 0%, transparent 55%),
    linear-gradient(180deg, #030910 0%, #050f1c 60%, #030910 100%);
}

.stage-viewport::before {
  position: absolute;
  inset: 0;
  content: '';
  background-image:
    linear-gradient(rgb(69 215 255 / 5%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(69 215 255 / 5%) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(ellipse at 50% 30%, black 0%, transparent 75%);
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
}
</style>
