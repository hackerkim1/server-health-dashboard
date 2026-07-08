import { defineStore } from 'pinia'

import rawData from '../data/dashboardData.json'
import type { DashboardData } from '../types/dashboard'

const dashboardData = rawData as DashboardData

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    data: null as DashboardData | null,
    error: '' as string,
    now: new Date(),
    clockTimer: 0 as number,
  }),
  actions: {
    async loadDashboard() {
      try {
        // 数据来自离线 tsar 采集日志的聚合结果，此处模拟一次异步加载
        await new Promise((resolve) => setTimeout(resolve, 120))
        this.data = dashboardData
      } catch {
        this.error = '监测数据加载失败'
      }
      this.startClock()
    },
    startClock() {
      if (this.clockTimer) return
      this.now = new Date()
      this.clockTimer = window.setInterval(() => {
        this.now = new Date()
      }, 1000)
    },
    stopClock() {
      if (this.clockTimer) {
        window.clearInterval(this.clockTimer)
        this.clockTimer = 0
      }
    },
  },
})
