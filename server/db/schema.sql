-- 服务器运行状况监测大屏 - MySQL 表结构
-- 与 data/raw 下的原始 tsar 采集文件一一对应，供 scripts/load-mysql.mjs 写入。

CREATE TABLE IF NOT EXISTS hosts (
  hostid    VARCHAR(16) NOT NULL PRIMARY KEY,
  hostname  VARCHAR(64) NOT NULL,
  owner     VARCHAR(32) NOT NULL,
  model     VARCHAR(32) NOT NULL,
  room      VARCHAR(16) NOT NULL,
  rack      VARCHAR(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 对应 pref_tsar.dat：每小时一次的性能采集，宽表存储，一行代表一台主机在某一时刻的完整快照
CREATE TABLE IF NOT EXISTS pref_metrics (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ts          BIGINT NOT NULL,
  hostid      VARCHAR(16) NOT NULL,
  cpu_user    DECIMAL(6,2),
  cpu_sys     DECIMAL(6,2),
  cpu_wait    DECIMAL(6,2),
  cpu_idle    DECIMAL(6,2),
  cpu_usage   DECIMAL(6,2),
  mem_used    INT,
  mem_free    INT,
  mem_buff    INT,
  mem_cache   INT,
  mem_swap    INT,
  net_in      DECIMAL(8,2),
  net_out     DECIMAL(8,2),
  net_pktin   INT,
  net_pktout  INT,
  load1       DECIMAL(6,2),
  load5       DECIMAL(6,2),
  load15      DECIMAL(6,2),
  proc_run    INT,
  proc_block  INT,
  proc_total  INT,
  UNIQUE KEY uk_host_ts (hostid, ts),
  KEY idx_ts (ts),
  CONSTRAINT fk_pref_host FOREIGN KEY (hostid) REFERENCES hosts (hostid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 对应 disk_tsar.dat：稀疏磁盘采样，保留原始 EAV 结构（不同磁盘/指标的采集时刻并不对齐）
CREATE TABLE IF NOT EXISTS disk_metrics (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ts          BIGINT NOT NULL,
  hostid      VARCHAR(16) NOT NULL,
  disk_letter VARCHAR(4) NOT NULL,
  metric      VARCHAR(16) NOT NULL,
  value       DECIMAL(12,2) NOT NULL,
  KEY idx_host_letter_metric_ts (hostid, disk_letter, metric, ts DESC),
  CONSTRAINT fk_disk_host FOREIGN KEY (hostid) REFERENCES hosts (hostid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 由 ETL 基于阈值边缘触发计算得到的告警事件（好转/恶化跳变时记一条）
CREATE TABLE IF NOT EXISTS alerts (
  id        VARCHAR(24) NOT NULL PRIMARY KEY,
  ts        BIGINT NOT NULL,
  hostid    VARCHAR(16) NOT NULL,
  hostname  VARCHAR(64) NOT NULL,
  room      VARCHAR(16) NOT NULL,
  metric    VARCHAR(24) NOT NULL,
  level     VARCHAR(8) NOT NULL,
  message   VARCHAR(255) NOT NULL,
  value     DECIMAL(10,2) NOT NULL,
  KEY idx_ts (ts DESC),
  CONSTRAINT fk_alert_host FOREIGN KEY (hostid) REFERENCES hosts (hostid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
