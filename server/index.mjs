import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mysql from 'mysql2/promise'

import { buildDashboard } from './lib/aggregate.mjs'
import { startCollector } from './lib/collector.mjs'

const PORT = Number(process.env.API_PORT ?? 8787)
const DB_HOST = process.env.DB_HOST ?? '127.0.0.1'
const DB_PORT = Number(process.env.DB_PORT ?? 3306)
const DB_USER = process.env.DB_USER ?? 'root'
const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
const DB_NAME = process.env.DB_NAME ?? 'server_health'

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
})

const app = express()
app.use(cors())

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/dashboard', async (_req, res) => {
  try {
    const data = await buildDashboard(pool)
    res.json(data)
  } catch (err) {
    console.error('查询数据库失败：', err)
    res.status(500).json({ error: '数据库查询失败，请确认已执行 npm run db:load 且数据库连接配置正确' })
  }
})

app.listen(PORT, () => {
  console.log(`API 服务已启动：http://localhost:${PORT}`)
  console.log(`MySQL 目标：${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`)
})

startCollector(pool).catch((err) => console.error('采集器启动失败：', err.message))
