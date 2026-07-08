// 模拟采集器：在 API 进程内常驻运行，按固定周期为每台主机生成一条新的性能采集点
// （从数据库里最后一条真实记录开始，做有界随机游走），并写回 MySQL。
// 这样前端的轮询请求每次查到的都是货真价实的"新数据"，而不是重复读同一份历史快照。
import { METRIC_DEFS, levelOf, round2 } from './metrics.mjs'

const TICK_MS = 8000
const CLEANUP_MS = 5 * 60 * 1000
const RETENTION_MS = 7 * 24 * 3600 * 1000
const DISK_SAMPLE_CHANCE = 0.35

const PREF_FIELDS = [
  'cpu_user', 'cpu_sys', 'cpu_wait', 'cpu_idle', 'cpu_usage',
  'mem_used', 'mem_free', 'mem_buff', 'mem_cache', 'mem_swap',
  'net_in', 'net_out', 'net_pktin', 'net_pktout',
  'load1', 'load5', 'load15',
  'proc_run', 'proc_block', 'proc_total',
]

// [min, max, 单次游走最大步长, 是否取整]
const PREF_BOUNDS = {
  cpu_user: [0, 100, 6], cpu_sys: [0, 100, 4], cpu_wait: [0, 100, 7], cpu_idle: [0, 100, 6], cpu_usage: [0, 100, 6],
  mem_used: [500, 135000, 4000], mem_free: [500, 135000, 4000], mem_buff: [500, 135000, 4000], mem_cache: [500, 135000, 4000], mem_swap: [500, 135000, 4000],
  net_in: [0, 1200, 90], net_out: [0, 1200, 90], net_pktin: [0, 100000, 4000], net_pktout: [0, 100000, 4000],
  load1: [0, 32, 3], load5: [0, 32, 2.2], load15: [0, 32, 1.6],
  proc_run: [0, 300, 20], proc_block: [0, 500, 35], proc_total: [0, 500, 30],
}
const INT_FIELDS = new Set(['mem_used', 'mem_free', 'mem_buff', 'mem_cache', 'mem_swap', 'net_pktin', 'net_pktout', 'proc_run', 'proc_block', 'proc_total'])

const DISK_LETTERS = ['sda', 'sdb', 'sdc', 'sdd', 'sde']
const DISK_BOUNDS = {
  rqm: [0, 200, 15],
  read: [0, 500000, 30000],
  write: [0, 500000, 30000],
  avgrq: [0, 1000, 60],
  await: [0, 50, 4],
  util: [0, 100, 7],
  svctm: [0, 50, 3],
}
const DISK_DEFAULTS = { rqm: 50, read: 200000, write: 200000, avgrq: 500, await: 20, util: 40, svctm: 15 }

function walk(prev, [min, max, step], isInt) {
  const delta = (Math.random() - 0.5) * 2 * step
  const next = Math.min(max, Math.max(min, prev + delta))
  return isInt ? Math.round(next) : round2(next)
}

async function seedState(pool) {
  const [[hosts]] = await Promise.all([pool.query('SELECT hostid, hostname, room FROM hosts')])

  const [latestPref] = await pool.query(`
    SELECT p.* FROM pref_metrics p
    INNER JOIN (SELECT hostid, MAX(ts) AS max_ts FROM pref_metrics GROUP BY hostid) latest
      ON latest.hostid = p.hostid AND latest.max_ts = p.ts
  `)
  const lastSnap = new Map()
  for (const row of latestPref) {
    const snap = {}
    for (const f of PREF_FIELDS) snap[f] = row[f] == null ? 0 : Number(row[f])
    lastSnap.set(row.hostid, snap)
  }

  const [latestDisk] = await pool.query(`
    SELECT hostid, disk_letter, metric, value FROM (
      SELECT hostid, disk_letter, metric, value,
             ROW_NUMBER() OVER (PARTITION BY hostid, disk_letter, metric ORDER BY ts DESC) AS rn
      FROM disk_metrics
    ) t WHERE rn = 1
  `)
  const lastDisk = new Map()
  for (const row of latestDisk) {
    lastDisk.set(`${row.hostid}_${row.disk_letter}_${row.metric}`, Number(row.value))
  }

  const lastLevel = new Map()
  for (const host of hosts) {
    const snap = lastSnap.get(host.hostid)
    if (!snap) continue
    for (const [metric, , pick, rule] of METRIC_DEFS) {
      lastLevel.set(`${host.hostid}_${metric}`, levelOf(pick(snap), rule))
    }
  }

  return { hosts, lastSnap, lastDisk, lastLevel, alertSeq: 0 }
}

async function tick(pool, state) {
  const ts = Date.now()
  const prefRows = []
  for (const host of state.hosts) {
    const prev = state.lastSnap.get(host.hostid) ?? Object.fromEntries(PREF_FIELDS.map((f) => [f, (PREF_BOUNDS[f][0] + PREF_BOUNDS[f][1]) / 2]))
    const next = {}
    for (const f of PREF_FIELDS) next[f] = walk(prev[f], PREF_BOUNDS[f], INT_FIELDS.has(f))
    state.lastSnap.set(host.hostid, next)
    prefRows.push([ts, host.hostid, ...PREF_FIELDS.map((f) => next[f])])
  }
  await pool.query(
    `INSERT INTO pref_metrics
      (ts, hostid, cpu_user, cpu_sys, cpu_wait, cpu_idle, cpu_usage,
       mem_used, mem_free, mem_buff, mem_cache, mem_swap,
       net_in, net_out, net_pktin, net_pktout,
       load1, load5, load15, proc_run, proc_block, proc_total)
     VALUES ?`,
    [prefRows],
  )

  const alertRows = []
  for (const host of state.hosts) {
    const snap = state.lastSnap.get(host.hostid)
    for (const [metric, label, pick, rule, unit] of METRIC_DEFS) {
      const value = pick(snap)
      const level = levelOf(value, rule)
      const key = `${host.hostid}_${metric}`
      const prevLevel = state.lastLevel.get(key) ?? 'good'
      if (level !== 'good' && level !== prevLevel) {
        state.alertSeq += 1
        alertRows.push([
          `live-${ts}-${state.alertSeq}`,
          ts,
          host.hostid,
          host.hostname,
          host.room,
          metric,
          level,
          `${host.hostname} ${label}升至 ${round2(value)}${unit}，触发${level === 'danger' ? '严重' : '预警'}告警`,
          round2(value),
        ])
      }
      state.lastLevel.set(key, level)
    }
  }
  if (alertRows.length) {
    await pool.query('INSERT INTO alerts (id, ts, hostid, hostname, room, metric, level, message, value) VALUES ?', [alertRows])
  }

  const diskRows = []
  for (const host of state.hosts) {
    if (Math.random() > DISK_SAMPLE_CHANCE) continue
    const letter = DISK_LETTERS[Math.floor(Math.random() * DISK_LETTERS.length)]
    const metric = Object.keys(DISK_BOUNDS)[Math.floor(Math.random() * Object.keys(DISK_BOUNDS).length)]
    const key = `${host.hostid}_${letter}_${metric}`
    const prevVal = state.lastDisk.get(key) ?? DISK_DEFAULTS[metric]
    const nextVal = walk(prevVal, DISK_BOUNDS[metric], false)
    state.lastDisk.set(key, nextVal)
    diskRows.push([ts, host.hostid, letter, metric, nextVal])
  }
  if (diskRows.length) {
    await pool.query('INSERT INTO disk_metrics (ts, hostid, disk_letter, metric, value) VALUES ?', [diskRows])
  }
}

async function cleanup(pool) {
  const cutoff = Date.now() - RETENTION_MS
  await pool.query('DELETE FROM pref_metrics WHERE ts < ?', [cutoff])
  await pool.query('DELETE FROM disk_metrics WHERE ts < ?', [cutoff])
  await pool.query('DELETE FROM alerts WHERE ts < ?', [cutoff])
}

export async function startCollector(pool) {
  const state = await seedState(pool)
  console.log(`模拟采集器已启动：每 ${TICK_MS / 1000}s 为 ${state.hosts.length} 台主机写入一条新采集点`)

  setInterval(() => {
    tick(pool, state).catch((err) => console.error('采集器写入失败：', err.message))
  }, TICK_MS)

  setInterval(() => {
    cleanup(pool).catch((err) => console.error('采集器清理失败：', err.message))
  }, CLEANUP_MS)
}
