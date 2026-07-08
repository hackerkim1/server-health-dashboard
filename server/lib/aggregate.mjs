// 从 MySQL 实时查询并聚合出大屏所需的完整数据结构。
// 每次调用都会重新查询数据库，保证前端轮询时拿到的是"当前"聚合结果。
import { METRIC_DEFS, computeRisk, levelOf, memUsagePct, round2 } from './metrics.mjs'

const DISK_LETTERS = ['sda', 'sdb', 'sdc', 'sdd', 'sde']

async function fetchLatestPrefByHost(pool) {
  const [rows] = await pool.query(`
    SELECT p.* FROM pref_metrics p
    INNER JOIN (
      SELECT hostid, MAX(ts) AS max_ts FROM pref_metrics GROUP BY hostid
    ) latest ON latest.hostid = p.hostid AND latest.max_ts = p.ts
  `)
  return new Map(rows.map((r) => [r.hostid, r]))
}

async function fetchLatestDiskByHost(pool) {
  const [rows] = await pool.query(`
    SELECT hostid, disk_letter, metric, value FROM (
      SELECT hostid, disk_letter, metric, value,
             ROW_NUMBER() OVER (PARTITION BY hostid, disk_letter, metric ORDER BY ts DESC) AS rn
      FROM disk_metrics
    ) t WHERE rn = 1
  `)
  const byHost = new Map()
  for (const r of rows) {
    let entry = byHost.get(r.hostid)
    if (!entry) {
      entry = { utilSum: 0, utilN: 0, awaitSum: 0, awaitN: 0, readSectors: 0, writeSectors: 0 }
      byHost.set(r.hostid, entry)
    }
    const value = Number(r.value)
    if (r.metric === 'util') {
      entry.utilSum += value
      entry.utilN += 1
    } else if (r.metric === 'await') {
      entry.awaitSum += value
      entry.awaitN += 1
    } else if (r.metric === 'read') {
      entry.readSectors += value
    } else if (r.metric === 'write') {
      entry.writeSectors += value
    }
  }
  const result = new Map()
  for (const [hostid, e] of byHost) {
    result.set(hostid, {
      util: e.utilN ? e.utilSum / e.utilN : 0,
      await: e.awaitN ? e.awaitSum / e.awaitN : 0,
      readMBs: (e.readSectors * 512) / 1024 / 1024,
      writeMBs: (e.writeSectors * 512) / 1024 / 1024,
    })
  }
  return result
}

async function fetchCpuMemTrend(pool, maxPoints = 300) {
  // 采集器持续写入后 ts 分组会越来越多，这里只取最近 maxPoints 个时间点，避免趋势图和响应体无限膨胀
  const [rows] = await pool.query(
    `
    SELECT ts, cpuUsage, memUsagePct FROM (
      SELECT ts,
             AVG(cpu_usage) AS cpuUsage,
             AVG(mem_used / (mem_used + mem_free) * 100) AS memUsagePct
      FROM pref_metrics
      GROUP BY ts
      ORDER BY ts DESC
      LIMIT ?
    ) recent
    ORDER BY ts
  `,
    [maxPoints],
  )
  return rows.map((r) => {
    const d = new Date(Number(r.ts))
    const time = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return { ts: Number(r.ts), time, cpuUsage: round2(Number(r.cpuUsage)), memUsagePct: round2(Number(r.memUsagePct)) }
  })
}

async function fetchAlerts(pool, limit = 40) {
  const [rows] = await pool.query('SELECT * FROM alerts ORDER BY ts DESC LIMIT ?', [limit])
  return rows.map((r) => ({
    id: r.id,
    ts: Number(r.ts),
    time: new Date(Number(r.ts)).toISOString(),
    hostid: r.hostid,
    hostname: r.hostname,
    room: r.room,
    metric: r.metric,
    level: r.level,
    message: r.message,
    value: Number(r.value),
  }))
}

export async function buildDashboard(pool) {
  const [[hostRows], prefByHost, diskByHost, cpuMemTrend, alerts, [[windowRow]]] = await Promise.all([
    pool.query('SELECT * FROM hosts ORDER BY hostid'),
    fetchLatestPrefByHost(pool),
    fetchLatestDiskByHost(pool),
    fetchCpuMemTrend(pool),
    fetchAlerts(pool),
    pool.query('SELECT MIN(ts) AS prefStart, MAX(ts) AS prefEnd FROM pref_metrics'),
  ])

  const enrichedHosts = hostRows.map((h) => {
    const p = prefByHost.get(h.hostid)
    const cpuUsage = p ? Number(p.cpu_usage) : 0
    const memPct = p ? memUsagePct(Number(p.mem_used), Number(p.mem_free)) : 0
    const load1 = p ? Number(p.load1) : 0
    const procBlock = p ? Number(p.proc_block) : 0
    const disk = diskByHost.get(h.hostid) ?? { util: 0, await: 0, readMBs: 0, writeMBs: 0 }

    const snap = { cpuUsage, memUsagePct: memPct, load1, procBlock }
    const { riskScore, riskLevel, status } = computeRisk(snap, disk)

    return {
      hostid: h.hostid,
      hostname: h.hostname,
      owner: h.owner,
      model: h.model,
      room: h.room,
      rack: h.rack,
      online: true,
      status,
      riskScore,
      riskLevel,
      cpuUsage: round2(cpuUsage),
      memUsagePct: round2(memPct),
      load1: round2(load1),
      procBlock,
      procTotal: p ? Number(p.proc_total) : 0,
      netIn: p ? round2(Number(p.net_in)) : 0,
      netOut: p ? round2(Number(p.net_out)) : 0,
      diskUtilAvg: round2(disk.util),
      diskAwaitAvg: round2(disk.await),
      diskReadMBs: round2(disk.readMBs),
      diskWriteMBs: round2(disk.writeMBs),
    }
  })

  const totalHosts = enrichedHosts.length
  const onlineHosts = enrichedHosts.filter((h) => h.online).length
  const healthyCount = enrichedHosts.filter((h) => h.status === 'good').length
  const warningCount = enrichedHosts.filter((h) => h.status === 'warning').length
  const dangerCount = enrichedHosts.filter((h) => h.status === 'danger').length
  const healthScore = round2(100 - (warningCount * 6 + dangerCount * 16) / totalHosts)
  const avgCpuUsage = round2(enrichedHosts.reduce((s, h) => s + h.cpuUsage, 0) / totalHosts)
  const avgMemUsage = round2(enrichedHosts.reduce((s, h) => s + h.memUsagePct, 0) / totalHosts)

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
    .map((r) => ({ room: r.room, total: r.total, healthy: r.healthy, warning: r.warning, danger: r.danger, avgHealth: round2(r.scoreSum / r.total) }))
    .sort((a, b) => a.room.localeCompare(b.room))

  const modelMap = new Map()
  for (const h of enrichedHosts) modelMap.set(h.model, (modelMap.get(h.model) ?? 0) + 1)
  const models = [...modelMap.entries()].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count)

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
    .map((h) => ({ hostid: h.hostid, hostname: h.hostname, readMBs: h.diskReadMBs, writeMBs: h.diskWriteMBs, totalMBs: round2(h.diskReadMBs + h.diskWriteMBs) }))
    .sort((a, b) => b.totalMBs - a.totalMBs)
    .slice(0, 8)

  const activeAlerts = []
  for (const h of hostRows) {
    const p = prefByHost.get(h.hostid)
    if (!p) continue
    for (const [metric, label, pick, rule, unit] of METRIC_DEFS) {
      const value = pick(p)
      if (value == null) continue
      const level = levelOf(value, rule)
      if (level === 'good') continue
      activeAlerts.push({ hostid: h.hostid, hostname: h.hostname, metric, label, level, value: round2(value), unit })
    }
  }
  const criticalAlerts = activeAlerts.filter((a) => a.level === 'danger').length
  const warningAlerts = activeAlerts.filter((a) => a.level === 'warning').length

  return {
    generatedAt: new Date().toISOString(),
    dataWindow: { prefStart: Number(windowRow.prefStart), prefEnd: Number(windowRow.prefEnd) },
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
    alerts,
  }
}
