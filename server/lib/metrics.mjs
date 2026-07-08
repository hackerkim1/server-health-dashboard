// 指标计算规则：ETL 导入脚本（scripts/load-mysql.mjs）与 API 服务（server/index.mjs）共用，
// 确保"入库时算出的告警"和"查询时算出的主机状态"使用同一套阈值与公式。

export const THRESHOLDS = {
  cpuUsage: { warn: 72, danger: 78 },
  memUsagePct: { warn: 82, danger: 90 },
  load1: { warn: 29, danger: 31 },
  procBlock: { warn: 450, danger: 480 },
  diskUtil: { warn: 90, danger: 96 },
  diskAwait: { warn: 45, danger: 48 },
}

export function levelOf(value, rule) {
  if (value >= rule.danger) return 'danger'
  if (value >= rule.warn) return 'warning'
  return 'good'
}

export function worse(a, b) {
  if (a === 'danger' || b === 'danger') return 'danger'
  if (a === 'warning' || b === 'warning') return 'warning'
  return 'good'
}

export function memUsagePct(memUsed, memFree) {
  if (memUsed == null || memFree == null) return 0
  const total = memUsed + memFree
  return total > 0 ? (memUsed / total) * 100 : 0
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

// snap: { cpuUsage, memUsagePct, load1, procBlock }
// disk: { util, await }
export function computeRisk(snap, disk) {
  const cpuN = Math.min(snap.cpuUsage, 100)
  const memN = Math.min(snap.memUsagePct, 100)
  const loadN = Math.min((snap.load1 / 32) * 100, 100)
  const diskUtilN = Math.min(disk.util, 100)
  const procBlockN = Math.min((snap.procBlock / 500) * 100, 100)
  const diskAwaitN = Math.min((disk.await / 50) * 100, 100)

  const riskScore = Math.round(
    cpuN * 0.2 + memN * 0.2 + loadN * 0.2 + diskUtilN * 0.2 + procBlockN * 0.1 + diskAwaitN * 0.1,
  )
  const riskLevel = riskScore >= 70 ? 'danger' : riskScore >= 50 ? 'warning' : 'good'

  const status = worse(
    worse(levelOf(snap.cpuUsage, THRESHOLDS.cpuUsage), levelOf(snap.memUsagePct, THRESHOLDS.memUsagePct)),
    worse(
      worse(levelOf(snap.load1, THRESHOLDS.load1), levelOf(snap.procBlock, THRESHOLDS.procBlock)),
      worse(levelOf(disk.util, THRESHOLDS.diskUtil), levelOf(disk.await, THRESHOLDS.diskAwait)),
    ),
  )

  return { riskScore, riskLevel, status }
}

// 告警指标定义：metric 字段名对应 pref_metrics 宽表列（mem_usage 为派生列）
export const METRIC_DEFS = [
  ['cpu_usage', 'CPU 使用率', (s) => s.cpu_usage, THRESHOLDS.cpuUsage, '%'],
  ['mem_usage', '内存使用率', (s) => memUsagePct(s.mem_used, s.mem_free), THRESHOLDS.memUsagePct, '%'],
  ['load1', '系统负载', (s) => s.load1, THRESHOLDS.load1, ''],
  ['proc_block', '阻塞进程数', (s) => s.proc_block, THRESHOLDS.procBlock, '个'],
]
