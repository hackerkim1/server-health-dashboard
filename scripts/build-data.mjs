// 离线数据加工脚本：读取 data/raw 下的原始 tsar 采集数据，
// 计算主机健康度/风险评分/机房与硬件分布/Top榜/告警/趋势等聚合指标，
// 输出为 src/data/dashboardData.json 供前端直接消费。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw')
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'dashboardData.json')

function readTsv(file) {
  const text = fs.readFileSync(path.join(RAW_DIR, file), 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines[0].split('\t')
  return lines.slice(1).map((line) => {
    const cols = line.split('\t')
    const row = {}
    header.forEach((key, i) => (row[key] = cols[i]))
    return row
  })
}

// ---------- 读取原始数据 ----------
const hostRows = readTsv('host_detail.dat')
const prefRows = readTsv('pref_tsar.dat').map((r) => ({
  ts: Number(r.ts),
  hostid: r.hostid,
  mod: r.mod,
  value: Number(r.value),
}))
const diskRows = readTsv('disk_tsar.dat').map((r) => ({
  ts: Number(r.ts),
  hostid: r.hostid,
  mod: r.mod,
  value: Number(r.value),
}))

const hosts = hostRows.map((h) => ({
  hostid: h.hostid,
  hostname: h.hostname,
  owner: h.owner,
  model: h.model,
  room: h.location1,
  rack: h.location2,
}))
const hostMeta = new Map(hosts.map((h) => [h.hostid, h]))

// ---------- 告警阈值（基于全量数据 p90/p95 分位数标定） ----------
const THRESHOLDS = {
  cpuUsage: { warn: 72, danger: 78 },
  memUsagePct: { warn: 82, danger: 90 },
  load1: { warn: 29, danger: 31 },
  procBlock: { warn: 450, danger: 480 },
  diskUtil: { warn: 90, danger: 96 },
  diskAwait: { warn: 45, danger: 48 },
}

function levelOf(value, rule) {
  if (value >= rule.danger) return 'danger'
  if (value >= rule.warn) return 'warning'
  return 'good'
}
const worse = (a, b) => (a === 'danger' || b === 'danger' ? 'danger' : a === 'warning' || b === 'warning' ? 'warning' : 'good')

// ---------- 整理 pref 时间序列：按 ts 排序的小时点 ----------
const tsSorted = [...new Set(prefRows.map((r) => r.ts))].sort((a, b) => a - b)
const lastTs = tsSorted[tsSorted.length - 1]

// hostid -> ts -> mod -> value
const prefByHostTs = new Map()
for (const r of prefRows) {
  let byTs = prefByHostTs.get(r.hostid)
  if (!byTs) {
    byTs = new Map()
    prefByHostTs.set(r.hostid, byTs)
  }
  let byMod = byTs.get(r.ts)
  if (!byMod) {
    byMod = {}
    byTs.set(r.ts, byMod)
  }
  byMod[r.mod] = r.value
}

function memUsagePct(snap) {
  if (!snap || snap.mem_used == null || snap.mem_free == null) return 0
  const total = snap.mem_used + snap.mem_free
  return total > 0 ? (snap.mem_used / total) * 100 : 0
}

// ---------- 磁盘：按 hostid+磁盘盘符 找最近一条样本 ----------
const DISK_LETTERS = ['sda', 'sdb', 'sdc', 'sdd', 'sde']
const DISK_METRICS = ['rqm', 'read', 'write', 'avgrq', 'await', 'util', 'svctm']

// hostid -> disk letter -> metric -> { ts, value }
const diskLatest = new Map()
for (const r of diskRows) {
  const [letter, metric] = r.mod.split('_')
  if (!DISK_LETTERS.includes(letter) || !DISK_METRICS.includes(metric)) continue
  let byLetter = diskLatest.get(r.hostid)
  if (!byLetter) {
    byLetter = new Map()
    diskLatest.set(r.hostid, byLetter)
  }
  let byMetric = byLetter.get(letter)
  if (!byMetric) {
    byMetric = {}
    byLetter.set(letter, byMetric)
  }
  const cur = byMetric[metric]
  if (!cur || r.ts > cur.ts) byMetric[metric] = { ts: r.ts, value: r.value }
}

function diskSummaryForHost(hostid) {
  const byLetter = diskLatest.get(hostid)
  if (!byLetter) return { util: 0, await: 0, readMBs: 0, writeMBs: 0, lastTs: 0 }
  let utilSum = 0
  let utilN = 0
  let awaitSum = 0
  let awaitN = 0
  let readSectors = 0
  let writeSectors = 0
  let latestTs = 0
  for (const letter of DISK_LETTERS) {
    const m = byLetter.get(letter)
    if (!m) continue
    if (m.util) {
      utilSum += m.util.value
      utilN += 1
      latestTs = Math.max(latestTs, m.util.ts)
    }
    if (m.await) {
      awaitSum += m.await.value
      awaitN += 1
    }
    // 扇区(512B) 每秒 -> MB/s
    if (m.read) readSectors += m.read.value
    if (m.write) writeSectors += m.write.value
  }
  return {
    util: utilN ? utilSum / utilN : 0,
    await: awaitN ? awaitSum / awaitN : 0,
    readMBs: (readSectors * 512) / 1024 / 1024,
    writeMBs: (writeSectors * 512) / 1024 / 1024,
    lastTs: latestTs,
  }
}

// ---------- 逐主机计算最新快照 + 风险评分 ----------
const enrichedHosts = hosts.map((h) => {
  const snap = prefByHostTs.get(h.hostid)?.get(lastTs) ?? {}
  const cpuUsage = snap.cpu_usage ?? 0
  const memPct = memUsagePct(snap)
  const load1 = snap.load1 ?? 0
  const procBlock = snap.proc_block ?? 0
  const procTotal = snap.proc_total ?? 0
  const netIn = snap.net_in ?? 0
  const netOut = snap.net_out ?? 0
  const disk = diskSummaryForHost(h.hostid)

  const cpuN = Math.min(cpuUsage, 100)
  const memN = Math.min(memPct, 100)
  const loadN = Math.min((load1 / 32) * 100, 100)
  const diskUtilN = Math.min(disk.util, 100)
  const procBlockN = Math.min((procBlock / 500) * 100, 100)
  const diskAwaitN = Math.min((disk.await / 50) * 100, 100)

  const riskScore = Math.round(
    cpuN * 0.2 + memN * 0.2 + loadN * 0.2 + diskUtilN * 0.2 + procBlockN * 0.1 + diskAwaitN * 0.1,
  )

  const level = worse(
    worse(levelOf(cpuUsage, THRESHOLDS.cpuUsage), levelOf(memPct, THRESHOLDS.memUsagePct)),
    worse(
      worse(levelOf(load1, THRESHOLDS.load1), levelOf(procBlock, THRESHOLDS.procBlock)),
      worse(levelOf(disk.util, THRESHOLDS.diskUtil), levelOf(disk.await, THRESHOLDS.diskAwait)),
    ),
  )

  const riskLevel = riskScore >= 70 ? 'danger' : riskScore >= 50 ? 'warning' : 'good'

  return {
    ...h,
    online: true,
    status: level,
    riskScore,
    riskLevel,
    cpuUsage: round2(cpuUsage),
    memUsagePct: round2(memPct),
    load1: round2(load1),
    procBlock,
    procTotal,
    netIn: round2(netIn),
    netOut: round2(netOut),
    diskUtilAvg: round2(disk.util),
    diskAwaitAvg: round2(disk.await),
    diskReadMBs: round2(disk.readMBs),
    diskWriteMBs: round2(disk.writeMBs),
  }
})

function round2(n) {
  return Math.round(n * 100) / 100
}

// ---------- 汇总指标 ----------
const totalHosts = enrichedHosts.length
const onlineHosts = enrichedHosts.filter((h) => h.online).length
const healthyCount = enrichedHosts.filter((h) => h.status === 'good').length
const warningCount = enrichedHosts.filter((h) => h.status === 'warning').length
const dangerCount = enrichedHosts.filter((h) => h.status === 'danger').length
const healthScore = round2(100 - (warningCount * 6 + dangerCount * 16) / totalHosts)
const avgCpuUsage = round2(enrichedHosts.reduce((s, h) => s + h.cpuUsage, 0) / totalHosts)
const avgMemUsage = round2(enrichedHosts.reduce((s, h) => s + h.memUsagePct, 0) / totalHosts)

// ---------- 机房健康度分布 ----------
const roomMap = new Map()
for (const h of enrichedHosts) {
  let r = roomMap.get(h.room)
  if (!r) {
    r = { room: h.room, total: 0, healthy: 0, warning: 0, danger: 0, scoreSum: 0 }
    roomMap.set(h.room, r)
  }
  r.total += 1
  r.scoreSum += 100 - h.riskScore
  if (h.status === 'good') r.healthy += 1
  else if (h.status === 'warning') r.warning += 1
  else r.danger += 1
}
const rooms = [...roomMap.values()]
  .map((r) => ({
    room: r.room,
    total: r.total,
    healthy: r.healthy,
    warning: r.warning,
    danger: r.danger,
    avgHealth: round2(r.scoreSum / r.total),
  }))
  .sort((a, b) => a.room.localeCompare(b.room))

// ---------- 硬件类型分布 ----------
const modelMap = new Map()
for (const h of enrichedHosts) modelMap.set(h.model, (modelMap.get(h.model) ?? 0) + 1)
const models = [...modelMap.entries()].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count)

// ---------- Top 榜 ----------
const riskTop = [...enrichedHosts]
  .sort((a, b) => b.riskScore - a.riskScore)
  .slice(0, 8)
  .map((h) => ({
    hostid: h.hostid,
    hostname: h.hostname,
    room: h.room,
    status: h.status,
    riskLevel: h.riskLevel,
    riskScore: h.riskScore,
    cpuUsage: h.cpuUsage,
    memUsagePct: h.memUsagePct,
  }))

const diskIoTop = [...enrichedHosts]
  .map((h) => ({
    hostid: h.hostid,
    hostname: h.hostname,
    readMBs: h.diskReadMBs,
    writeMBs: h.diskWriteMBs,
    totalMBs: round2(h.diskReadMBs + h.diskWriteMBs),
  }))
  .sort((a, b) => b.totalMBs - a.totalMBs)
  .slice(0, 8)

// ---------- 集群 CPU / 内存小时趋势（近 7 天） ----------
const cpuMemTrend = tsSorted.map((ts) => {
  let cpuSum = 0
  let memSum = 0
  let n = 0
  for (const h of hosts) {
    const snap = prefByHostTs.get(h.hostid)?.get(ts)
    if (!snap) continue
    cpuSum += snap.cpu_usage ?? 0
    memSum += memUsagePct(snap)
    n += 1
  }
  const d = new Date(ts)
  const label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`
  return {
    ts,
    time: label,
    cpuUsage: n ? round2(cpuSum / n) : 0,
    memUsagePct: n ? round2(memSum / n) : 0,
  }
})

// ---------- 告警事件：边缘触发（好转/恶化跳变时才记一条事件），避免逐小时重复刷屏 ----------
const METRIC_DEFS = [
  ['cpu_usage', 'CPU 使用率', (s) => s.cpu_usage, THRESHOLDS.cpuUsage, '%'],
  ['mem_usage', '内存使用率', (s) => memUsagePct(s), THRESHOLDS.memUsagePct, '%'],
  ['load1', '系统负载', (s) => s.load1, THRESHOLDS.load1, ''],
  ['proc_block', '阻塞进程数', (s) => s.proc_block, THRESHOLDS.procBlock, '个'],
]

const alerts = []
let alertSeq = 0
for (const h of hosts) {
  const byTs = prefByHostTs.get(h.hostid)
  if (!byTs) continue
  for (const [metric, label, pick, rule, unit] of METRIC_DEFS) {
    let prevLevel = 'good'
    for (const ts of tsSorted) {
      const snap = byTs.get(ts)
      if (!snap) continue
      const value = pick(snap)
      if (value == null) continue
      const level = levelOf(value, rule)
      if (level !== 'good' && level !== prevLevel) {
        alertSeq += 1
        alerts.push({
          id: `alt-${alertSeq}`,
          ts,
          time: new Date(ts).toISOString(),
          hostid: h.hostid,
          hostname: h.hostname,
          room: h.room,
          metric,
          level,
          message: `${h.hostname} ${label}升至 ${round2(value)}${unit}，触发${level === 'danger' ? '严重' : '预警'}告警`,
          value: round2(value),
        })
      }
      prevLevel = level
    }
  }
}
alerts.sort((a, b) => b.ts - a.ts)
const recentAlerts = alerts.slice(0, 40)

// ---------- 活跃告警：基于最新快照，当前仍处于告警状态的主机指标 ----------
const activeAlerts = []
for (const h of hosts) {
  const snap = prefByHostTs.get(h.hostid)?.get(lastTs)
  if (!snap) continue
  for (const [metric, label, pick, rule, unit] of METRIC_DEFS) {
    const value = pick(snap)
    if (value == null) continue
    const level = levelOf(value, rule)
    if (level === 'good') continue
    activeAlerts.push({ hostid: h.hostid, hostname: h.hostname, metric, label, level, value: round2(value), unit })
  }
}
const criticalAlerts = activeAlerts.filter((a) => a.level === 'danger').length
const warningAlerts = activeAlerts.filter((a) => a.level === 'warning').length

// ---------- 输出 ----------
const output = {
  generatedAt: new Date().toISOString(),
  dataWindow: {
    prefStart: tsSorted[0],
    prefEnd: lastTs,
  },
  summary: {
    totalHosts,
    onlineHosts,
    offlineHosts: totalHosts - onlineHosts,
    onlineRate: round2((onlineHosts / totalHosts) * 100),
    healthScore,
    healthyCount,
    warningCount,
    dangerCount,
    activeAlerts: activeAlerts.length,
    criticalAlerts,
    warningAlerts,
    avgCpuUsage,
    avgMemUsage,
  },
  rooms,
  models,
  hosts: enrichedHosts,
  riskTop,
  diskIoTop,
  cpuMemTrend,
  alerts: recentAlerts,
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, JSON.stringify(output))
console.log('written', OUT_FILE, (fs.statSync(OUT_FILE).size / 1024).toFixed(1), 'KB')
console.log('summary', output.summary)
console.log('rooms', output.rooms)
console.log('models', output.models)
console.log('riskTop[0..2]', output.riskTop.slice(0, 3))
console.log('alerts total', alerts.length, 'recent kept', recentAlerts.length)
