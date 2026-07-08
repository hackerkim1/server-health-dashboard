import { defineStore } from 'pinia'

import type { DashboardData } from '../types/dashboard'

const API_URL = '/api/dashboard'
const POLL_INTERVAL_MS = 15000

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    data: null as DashboardData | null,
    error: '' as string,
    loading: false,
    lastFetchedAt: null as Date | null,
    now: new Date(),
    clockTimer: 0 as number,
    pollTimer: 0 as number,
  }),
  actions: {
    async fetchDashboard() {
      this.loading = true
      try {
        const res = await fetch(API_URL)
        if (!res.ok) throw new Error(`接口返回 ${res.status}`)
        this.data = (await res.json()) as DashboardData
        this.lastFetchedAt = new Date()
        this.error = ''
      } catch (err) {
        this.error = err instanceof Error ? `监测数据加载失败：${err.message}` : '监测数据加载失败'
      } finally {
        this.loading = false
      }
    },
    async loadDashboard() {
      await this.fetchDashboard()
      this.startClock()
      this.startPolling()
    },
    startClock() {
      if (this.clockTimer) return
      this.now = new Date()
      this.clockTimer = window.setInterval(() => {
        this.now = new Date()
      }, 1000)
    },
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = window.setInterval(() => {
        void this.fetchDashboard()
      }, POLL_INTERVAL_MS)
    },
    dispose() {
      if (this.clockTimer) {
        window.clearInterval(this.clockTimer)
        this.clockTimer = 0
      }
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer)
        this.pollTimer = 0
      }
    },
  },
})
