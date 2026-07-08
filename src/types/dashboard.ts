export type StatusLevel = 'good' | 'warning' | 'danger'

export interface SummaryData {
  totalHosts: number
  onlineHosts: number
  offlineHosts: number
  onlineRate: number
  healthScore: number
  healthyCount: number
  warningCount: number
  dangerCount: number
  activeAlerts: number
  criticalAlerts: number
  warningAlerts: number
  avgCpuUsage: number
  avgMemUsage: number
}

export interface RoomHealth {
  room: string
  total: number
  healthy: number
  warning: number
  danger: number
  avgHealth: number
}

export interface ModelDistribution {
  model: string
  count: number
}

export interface HostRecord {
  hostid: string
  hostname: string
  owner: string
  model: string
  room: string
  rack: string
  online: boolean
  status: StatusLevel
  riskScore: number
  riskLevel: StatusLevel
  cpuUsage: number
  memUsagePct: number
  load1: number
  procBlock: number
  procTotal: number
  netIn: number
  netOut: number
  diskUtilAvg: number
  diskAwaitAvg: number
  diskReadMBs: number
  diskWriteMBs: number
}

export interface RiskRankItem {
  hostid: string
  hostname: string
  room: string
  status: StatusLevel
  riskLevel: StatusLevel
  riskScore: number
  cpuUsage: number
  memUsagePct: number
}

export interface DiskIoRankItem {
  hostid: string
  hostname: string
  readMBs: number
  writeMBs: number
  totalMBs: number
}

export interface TrendPoint {
  ts: number
  time: string
  cpuUsage: number
  memUsagePct: number
}

export interface AlertItem {
  id: string
  ts: number
  time: string
  hostid: string
  hostname: string
  room: string
  metric: string
  level: StatusLevel
  message: string
  value: number
}

export interface DashboardData {
  generatedAt: string
  dataWindow: { prefStart: number; prefEnd: number }
  summary: SummaryData
  rooms: RoomHealth[]
  models: ModelDistribution[]
  hosts: HostRecord[]
  riskTop: RiskRankItem[]
  diskIoTop: DiskIoRankItem[]
  cpuMemTrend: TrendPoint[]
  alerts: AlertItem[]
}
