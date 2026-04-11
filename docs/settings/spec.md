# Settings · 设置

> 设置不是功能菜单，是**用户对自己的数据与人格的掌控面板**。

---

## 1. 目标

- PRD §F6 "AI 记得什么" 面板
- persona 温度三维 slider
- 数据导出 / 一键删除
- 主题 / 声音开关

**形态**：全部在 Drawer 里。不开独立路由页面（除 `/settings` 作为 drawer 的深链接）。

---

## 2. Sections

| Section | 内容 |
|:---|:---|
| Profile | 姓名 · 时区 · AI 伙伴的名字 |
| My Companion | SOUL.md 正文编辑 + 三维 slider |
| What it remembers | L1 字段 · L3 digest 列表（按日期 · 可删） · L4 趋势摘要 |
| Appearance | 主题切换 · 声音开关 |
| Data | 导出 · 一键删除 |
| Account | 登出 · 邮箱修改 · 订阅（Phase 2） |

---

## 3. What it remembers 面板

```
┌──────────────────────────────────────────────────┐
│  WHAT IT REMEMBERS                               │
│                                                  │
│  CORE                                            │
│  Name       晓明                                 │
│  City       Shanghai                             │
│  Role       Product Manager                      │
│  Values     Autonomy · Depth                     │
│  [edit]                                          │
│                                                  │
│  SESSIONS · 28 entries                           │
│  2026-04-11 · Side project MVP           [×]     │
│  2026-04-10 · Daily writing              [×]     │
│  ...                                             │
│  [show older]                                    │
│                                                  │
│  LONG-TERM TRENDS · week 15                      │
│  - Most effective trigger: desk at 9pm           │
│  - Most missed day: Wednesday                    │
│  - Emotional arc: steady, dip near end of week   │
│                                                  │
│  [forget everything]                             │
│                                                  │
└──────────────────────────────────────────────────┘
```

- 点击 `[×]` → `memory.forgetDigest`，二次确认
- `[forget everything]` → `memory.deleteAll` + 登出

---

## 4. 数据导出

点击 → 后端 `memory.exportAll` → 生成 `data/exports/{userId}-{ts}.tar.gz`：

```
export/
├── profile.md
├── goals.md
├── memory.md
├── soul.md
├── digests/
├── trends/
└── database.json    ← goals/milestones/actions/ii/conversations/messages
```

前端下载。

---

## 5. 一键删除

两步确认：
1. "This will permanently delete your account and all memories."
2. 输入邮箱确认

后端流程：
- `memory.deleteAll(userId)` 递归删 workspace
- SQLite 级联删 users → sessions → conversations → messages → goals → ...
- 销毁当前 session
- 返回 302 → `/`

---

## 6. 端点

| Method | Path | 说明 |
|:---|:---|:---|
| `GET` | `/api/settings` | 拉所有 section 数据 |
| `PATCH` | `/api/settings/profile` | Name / timezone / companion name |
| `PATCH` | `/api/settings/persona` | 三维 patch · SOUL.md 正文 |
| `DELETE` | `/api/settings/memory/digests/:segmentId` | 软删除一条 digest |
| `POST` | `/api/settings/export` | 生成 tar.gz · 返回下载链接 |
| `DELETE` | `/api/settings/account` | 一键删除 |

---

## 7. 测试要点

- slider 拖动 → SOUL.md frontmatter 写入
- 删除一条 digest → memory 中向量与文件同步
- 导出 tar.gz 解压后内容完整
- 一键删除后 workspace 目录不存在

---

## 8. 依赖

- `memory` — 读写 · forget · export · delete
- `persona` — manualSet
- `auth` — 登出 · 账号操作
- `shell` — Drawer
