# Scheduler · 定时任务

> 单进程 node-cron + 文件锁，不引入 BullMQ / Redis。

---

## 1. 目标

- Digest 写入（持续）
- 周聚合 L4（周日 23:00）
- 沉默检测（每小时）
- 周复盘提醒（周日 09:00）
- 备份（每日 03:00）
- 重要度衰减（每周一 04:00）
- 老 digest 归档（每月 1 日）

---

## 2. 架构

```
apps/api/src/worker.ts     ← 独立进程
├── cron-registry.ts
├── locks.ts                ← proper-lockfile
└── jobs/
    ├── digest-writer.ts
    ├── weekly-aggregate.ts
    ├── silence-detect.ts
    ├── weekly-retro-nudge.ts
    ├── backup.ts
    ├── importance-decay.ts
    └── digest-archive.ts
```

---

## 3. Job 表

| Job | 触发 | 说明 |
|:---|:---|:---|
| digest-writer | 每 60s 轮询 | `digest_written=0` 且 `last_msg_at < now-30min` |
| weekly-aggregate | `0 23 * * 0` | 每用户 → L4 trends/week-{iso}.md |
| silence-detect | `0 * * * *` | >7 天未对话 → 标记以便下次开场 reconnect |
| weekly-retro-nudge | `0 9 * * 0` | 如用户该周 conversation 数 <3 → 主动推送 |
| backup | `0 3 * * *` | `tar -czf backups/data-{date}.tar.gz data/` · 保留 14 天 |
| importance-decay | `0 4 * * 1` | memory.decayAllImportance |
| digest-archive | `0 5 1 * *` | 90 天前的 digests → `archive/{year}.tar` |

---

## 4. 文件锁

```ts
import { lock } from 'proper-lockfile';

async function runLocked(jobName: string, fn: () => Promise<void>) {
  const release = await lock(`data/locks/${jobName}.lock`, { retries: 0 });
  try { await fn(); } finally { await release(); }
}
```

所有 job wrap in runLocked，即便多进程启动也不会重复执行。

---

## 5. 状态持久化

`data/scheduler-state.json`：

```json
{
  "digest-writer": { "lastRunAt": 1712825400, "processed": 1823 },
  "weekly-aggregate": { "lastRunAt": 1712700000, "users": 120 }
}
```

重启后读这个文件，决定下次 cron 是否补跑。

---

## 6. 失败处理

- Job 抛错 → log error · 下次 cron 重试
- 同一 job 连续失败 3 次 → 写入 `data/job-failures.jsonl`
- digest-writer 失败的 conversation 不标记 `digest_written=1`，下轮自动重试

---

## 7. 测试要点

- Mock cron · 触发每个 job 的 happy path
- 两个进程同时启动 · 锁生效
- digest-writer 失败 → 下轮重试
- scheduler-state 读写

---

## 8. 依赖

- `node-cron`
- `proper-lockfile`
- `memory` · `llm` · `conversation` — 各 job 调用
