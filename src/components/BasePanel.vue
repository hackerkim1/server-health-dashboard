<template>
  <section class="base-panel">
    <header class="base-panel__head">
      <span class="base-panel__bar" />
      <h3 class="base-panel__title">{{ title }}</h3>
      <span v-if="subtitle" class="base-panel__subtitle">{{ subtitle }}</span>
    </header>
    <div class="base-panel__body">
      <slot />
    </div>
    <i class="base-panel__corner base-panel__corner--tl" />
    <i class="base-panel__corner base-panel__corner--tr" />
    <i class="base-panel__corner base-panel__corner--bl" />
    <i class="base-panel__corner base-panel__corner--br" />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.base-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px 14px;
  background: linear-gradient(180deg, rgb(11 28 48 / 88%) 0%, rgb(6 16 29 / 88%) 100%);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 20%) inset,
    0 8px 24px rgb(0 10 25 / 35%);
}

.base-panel__head {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 10px;
}

.base-panel__bar {
  width: 3px;
  height: 13px;
  background: var(--cyan);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--cyan);
}

.base-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text);
}

.base-panel__subtitle {
  font-size: 11px;
  color: var(--muted);
}

.base-panel__body {
  flex: 1;
  min-height: 0;
}

.base-panel__corner {
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  border: 2px solid var(--cyan-soft);
  opacity: 0.65;
}

.base-panel__corner--tl {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
}

.base-panel__corner--tr {
  top: -1px;
  right: -1px;
  border-bottom: none;
  border-left: none;
}

.base-panel__corner--bl {
  bottom: -1px;
  left: -1px;
  border-top: none;
  border-right: none;
}

.base-panel__corner--br {
  right: -1px;
  bottom: -1px;
  border-top: none;
  border-left: none;
}
</style>
