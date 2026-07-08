<template>
  <BigScreenLayout>
    <main class="dashboard-view">
      <ScreenHeader :now="dashboard.now" />

      <section v-if="dashboard.data" class="dashboard-view__content">
        <div class="dashboard-view__metrics">
          <MetricCard
            label="主机总数"
            :value="summary.totalHosts"
            unit="台"
            status="neutral"
            :desc="`覆盖 ${data.rooms.length} 个机房`"
          />
          <MetricCard
            label="在线主机数"
            :value="summary.onlineHosts"
            unit="台"
            status="good"
            :desc="`在线率 ${summary.onlineRate}%`"
          />
          <MetricCard
            label="集群健康度"
            :value="summary.healthScore"
            unit="分"
            :status="healthCardStatus"
            :desc="`健康 ${summary.healthyCount} · 预警 ${summary.warningCount} · 严重 ${summary.dangerCount}`"
          />
          <MetricCard
            label="活跃告警"
            :value="summary.activeAlerts"
            unit="条"
            :status="summary.criticalAlerts > 0 ? 'danger' : summary.warningAlerts > 0 ? 'warning' : 'good'"
            :desc="`严重 ${summary.criticalAlerts} · 预警 ${summary.warningAlerts}`"
          />
        </div>

        <div class="dashboard-view__grid">
          <div class="dashboard-view__left">
            <BasePanel title="CPU / 内存利用率趋势" subtitle="近 7 天 · 集群均值">
              <CpuMemTrendChart :data="data.cpuMemTrend" />
            </BasePanel>
            <BasePanel title="机房健康度分布">
              <RoomHealthChart :data="data.rooms" />
            </BasePanel>
          </div>

          <BasePanel title="主机健康矩阵" subtitle="按机房分组 · 悬浮查看详情" class="dashboard-view__hub">
            <div class="hub-panel">
              <div class="hub-panel__gauge">
                <HealthGauge :score="summary.healthScore" />
              </div>
              <div class="hub-panel__legend">
                <span class="hub-panel__legend-item hub-panel__legend-item--good">健康 {{ summary.healthyCount }}</span>
                <span class="hub-panel__legend-item hub-panel__legend-item--warning">预警 {{ summary.warningCount }}</span>
                <span class="hub-panel__legend-item hub-panel__legend-item--danger">严重 {{ summary.dangerCount }}</span>
              </div>
              <div class="hub-panel__matrix">
                <HostMatrix :hosts="data.hosts" />
              </div>
            </div>
          </BasePanel>

          <div class="dashboard-view__right">
            <BasePanel title="硬件类型分布">
              <ModelPieChart :data="data.models" />
            </BasePanel>
            <BasePanel title="主机风险 Top榜">
              <RiskRankChart :data="data.riskTop" />
            </BasePanel>
          </div>
        </div>

        <div class="dashboard-view__bottom">
          <BasePanel title="磁盘读写 Top榜" subtitle="按最近采集吞吐排序">
            <DiskIoRankChart :data="data.diskIoTop" />
          </BasePanel>
          <BasePanel title="实时告警" :subtitle="`最近 ${data.alerts.length} 条`">
            <AlertFeed :alerts="data.alerts" />
          </BasePanel>
        </div>
      </section>

      <section v-else class="dashboard-view__state">
        {{ dashboard.error || '监测数据加载中...' }}
      </section>
    </main>
  </BigScreenLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AlertFeed from '../components/AlertFeed.vue'
import BasePanel from '../components/BasePanel.vue'
import HostMatrix from '../components/HostMatrix.vue'
import MetricCard from '../components/MetricCard.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import BigScreenLayout from '../layouts/BigScreenLayout.vue'
import { useDashboardStore } from '../stores/dashboardStore'

import CpuMemTrendChart from '../charts/CpuMemTrendChart.vue'
import DiskIoRankChart from '../charts/DiskIoRankChart.vue'
import HealthGauge from '../charts/HealthGauge.vue'
import ModelPieChart from '../charts/ModelPieChart.vue'
import RiskRankChart from '../charts/RiskRankChart.vue'
import RoomHealthChart from '../charts/RoomHealthChart.vue'

const dashboard = useDashboardStore()

onMounted(() => {
  void dashboard.loadDashboard()
})

const data = computed(() => dashboard.data!)
const summary = computed(() => data.value.summary)
const healthCardStatus = computed(() => {
  if (summary.value.healthScore >= 95) return 'good'
  if (summary.value.healthScore >= 85) return 'warning'
  return 'danger'
})
</script>

<style scoped>
.dashboard-view {
  display: grid;
  grid-template-rows: 86px 1fr;
  width: 100%;
  height: 100%;
  color: var(--text);
}

.dashboard-view__content {
  display: grid;
  grid-template-rows: 106px 1fr 214px;
  gap: 14px;
  min-height: 0;
  padding: 14px 20px 20px;
}

.dashboard-view__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  min-height: 0;
}

.dashboard-view__grid {
  display: grid;
  grid-template-columns: 25% 1fr 25%;
  gap: 14px;
  min-height: 0;
}

.dashboard-view__left,
.dashboard-view__right {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 14px;
  min-height: 0;
}

.dashboard-view__hub {
  min-height: 0;
}

.dashboard-view__bottom {
  display: grid;
  grid-template-columns: 44% 1fr;
  gap: 14px;
  min-height: 0;
}

.dashboard-view__state {
  display: grid;
  place-items: center;
  font-size: 20px;
  color: var(--muted);
}

.hub-panel {
  display: grid;
  grid-template-columns: 130px 1fr;
  grid-template-rows: auto 1fr;
  column-gap: 16px;
  height: 100%;
}

.hub-panel__gauge {
  grid-row: 1 / span 2;
  height: 130px;
}

.hub-panel__legend {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 12px;
}

.hub-panel__legend-item::before {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  content: '';
  border-radius: 50%;
}

.hub-panel__legend-item--good {
  color: var(--green);
}

.hub-panel__legend-item--good::before {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}

.hub-panel__legend-item--warning {
  color: var(--amber);
}

.hub-panel__legend-item--warning::before {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber);
}

.hub-panel__legend-item--danger {
  color: var(--red);
}

.hub-panel__legend-item--danger::before {
  background: var(--red);
  box-shadow: 0 0 6px var(--red);
}

.hub-panel__matrix {
  grid-column: 2;
  min-height: 0;
}
</style>
