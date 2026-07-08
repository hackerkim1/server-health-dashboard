// ETL：解析 data/raw 下的原始 tsar 采集文件，写入 MySQL。
// 用法：先在 .env 中配置数据库连接信息，再执行 `npm run db:load`。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import 'dotenv/config'
import mysql from 'mysql2/promise'

import { METRIC_DEFS, levelOf, round2 } from '../server/lib/metrics.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw')
const SCHEMA_FILE = path.join(__dirname, '..', 'server', 'db', 'schema.sql')

const DB_HOST = process.env.DB_HOST ?? '127.0.0.1'
const DB_PORT = Number(process.env.DB_PORT ?? 3306)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'server_health'

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

async function insertBatches(conn, sql, rows, batchSize = 1000) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    await conn.query(sql, [batch])
  }
}

async function main() {
  console.log(`连接 MySQL ${DB_USER}@${DB_HOST}:${DB_PORT} ...`)

  // 第一步：不指定库名连接，确保目标数据库存在
  const bootstrap = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD })
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`)
  await bootstrap.end()

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  })

  console.log('建表 ...')
  const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8')
  await conn.query(schemaSql)

  console.log('清空旧数据 ...')
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  await conn.query('TRUNCATE TABLE alerts')
  await conn.query('TRUNCATE TABLE disk_metrics')
  await conn.query('TRUNCATE TABLE pref_metrics')
  await conn.query('TRUNCATE TABLE hosts')
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')

  // ---------- hosts ----------
  const hostRows = readTsv('host_detail.dat')
  const hosts = hostRows.map((h) => [h.hostid, h.hostname, h.owner, h.model, h.location1, h.location2])
  console.log(`写入 hosts：${hosts.length} 行`)
  await conn.query('INSERT INTO hosts (hostid, hostname, owner, model, room, rack) VALUES ?', [hosts])

  // ---------- pref_metrics：长表 -> 按 (ts,hostid) 转宽表 ----------
  const prefRaw = readTsv('pref_tsar.dat').map((r) => ({ ts: Number(r.ts), hostid: r.hostid, mod: r.mod, value: Number(r.value) }))
  const wideMap = new Map() // `${ts}_${hostid}` -> row object
  for (const r of prefRaw) {
    const key = `${r.ts}_${r.hostid}`
    let row = wideMap.get(key)
    if (!row) {
      row = { ts: r.ts, hostid: r.hostid }
      wideMap.set(key, row)
    }
    row[r.mod] = r.value
  }
  const prefRows = [...wideMap.values()].map((r) => [
    r.ts,
    r.hostid,
    r.cpu_user ?? null,
    r.cpu_sys ?? null,
    r.cpu_wait ?? null,
    r.cpu_idle ?? null,
    r.cpu_usage ?? null,
    r.mem_used ?? null,
    r.mem_free ?? null,
    r.mem_buff ?? null,
    r.mem_cache ?? null,
    r.mem_swap ?? null,
    r.net_in ?? null,
    r.net_out ?? null,
    r.net_pktin ?? null,
    r.net_pktout ?? null,
    r.load1 ?? null,
    r.load5 ?? null,
    r.load15 ?? null,
    r.proc_run ?? null,
    r.proc_block ?? null,
    r.proc_total ?? null,
  ])
  console.log(`写入 pref_metrics：${prefRows.length} 行`)
  await insertBatches(
    conn,
    `INSERT INTO pref_metrics
      (ts, hostid, cpu_user, cpu_sys, cpu_wait, cpu_idle, cpu_usage,
       mem_used, mem_free, mem_buff, mem_cache, mem_swap,
       net_in, net_out, net_pktin, net_pktout,
       load1, load5, load15, proc_run, proc_block, proc_total)
     VALUES ?`,
    prefRows,
  )

  // ---------- disk_metrics：保留原始 EAV 结构 ----------
  const diskRaw = readTsv('disk_tsar.dat')
  const DISK_LETTERS = ['sda', 'sdb', 'sdc', 'sdd', 'sde']
  const diskRows = diskRaw
    .map((r) => {
      const [letter, metric] = r.mod.split('_')
      if (!DISK_LETTERS.includes(letter)) return null
      return [Number(r.ts), r.hostid, letter, metric, Number(r.value)]
    })
    .filter(Boolean)
  console.log(`写入 disk_metrics：${diskRows.length} 行`)
  await insertBatches(conn, 'INSERT INTO disk_metrics (ts, hostid, disk_letter, metric, value) VALUES ?', diskRows)

  // ---------- alerts：边缘触发扫描全量 pref 数据 ----------
  console.log('计算告警事件 ...')
  const byHost = new Map()
  for (const row of wideMap.values()) {
    let arr = byHost.get(row.hostid)
    if (!arr) {
      arr = []
      byHost.set(row.hostid, arr)
    }
    arr.push(row)
  }
  const hostMeta = new Map(hostRows.map((h) => [h.hostid, h]))

  const alertRows = []
  let seq = 0
  for (const [hostid, rows] of byHost) {
    rows.sort((a, b) => a.ts - b.ts)
    const meta = hostMeta.get(hostid)
    for (const [metric, label, pick, rule, unit] of METRIC_DEFS) {
      let prevLevel = 'good'
      for (const snap of rows) {
        const value = pick(snap)
        if (value == null) continue
        const level = levelOf(value, rule)
        if (level !== 'good' && level !== prevLevel) {
          seq += 1
          alertRows.push([
            `alt-${seq}`,
            snap.ts,
            hostid,
            meta.hostname,
            meta.location1,
            metric,
            level,
            `${meta.hostname} ${label}升至 ${round2(value)}${unit}，触发${level === 'danger' ? '严重' : '预警'}告警`,
            round2(value),
          ])
        }
        prevLevel = level
      }
    }
  }
  console.log(`写入 alerts：${alertRows.length} 行`)
  await insertBatches(conn, 'INSERT INTO alerts (id, ts, hostid, hostname, room, metric, level, message, value) VALUES ?', alertRows)

  await conn.end()
  console.log('完成。')
}

main().catch((err) => {
  console.error('导入失败：', err.message)
  process.exit(1)
})
