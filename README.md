# 服务器运行状况监测大屏（ServerHealthDashboard）

面向运维负责人视角的服务器运行状况实时监测可视化大屏。基于真实的 tsar 采集日志（`data/raw/`）离线加工生成聚合指标，前端使用 Vue 3 + TypeScript + ECharts + Pinia 渲染。

## 数据来源与加工

`data/raw/` 下的四个原始文件由 `scripts/build-data.mjs` 解析、清洗、聚合：

- `host_detail.dat`：20 台主机的基础信息（主机名、负责人、机型、机房、机柜）
- `mod_detail.dat`：性能 / 磁盘采集指标的元数据（单位、分类）
- `pref_tsar.dat`：近 7 天、每小时一次的 CPU / 内存 / 网络 / 负载 / 进程采集数据
- `disk_tsar.dat`：稀疏采样的磁盘 IO / 利用率 / 时延数据

脚本据此计算：主机健康状态与风险评分、机房健康度分布、硬件类型分布、主机风险 Top榜、磁盘读写 Top榜、CPU/内存集群趋势、基于阈值边缘触发的告警事件等，输出到 `src/data/dashboardData.json` 供前端直接消费（`npm run dev` / `npm run build` 会自动重新生成）。

## 开发

```bash
npm install
npm run dev      # 本地开发（自动先跑 build:data 生成最新聚合数据）
npm run build    # 类型检查 + 生产构建
npm run build:data  # 单独重新生成 src/data/dashboardData.json
```

## 页面结构

16:9 自适应大屏（`src/layouts/BigScreenLayout.vue`，1920×1080 舞台按视口等比缩放居中，无滚动条）：

- 顶部：标题 + 实时时钟
- 指标卡：主机总数 / 在线主机数 / 集群健康度 / 活跃告警
- 主区：CPU/内存利用率趋势、机房健康度分布、主机健康矩阵（按机房分组、悬浮查看详情）、硬件类型分布、主机风险 Top榜
- 底部：磁盘读写 Top榜、实时告警流水
