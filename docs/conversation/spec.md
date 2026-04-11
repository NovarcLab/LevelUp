# Conversation · 对话主模块

> 对话是第一界面。这个模块是把 persona · memory · context · llm · card 串起来的那根线。

---

## 1. 目标

- 承载 PRD F1 对话主界面全部能力
- 消息零丢失（PRD §13）
- 首字响应 <1.5s（SSE 流式）
- 提供命令前缀 `/` 快捷入口

**非目标**
- 不决定人格（交给 persona）
- 不决定卡片（交给 card-decision）
- 不管长期记忆（交给 memory）

---

## 2. 数据模型（SQLite）

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  context_goal_id TEXT REFERENCES goals(id),
  started_at INTEGER NOT NULL,
  last_msg_at INTEGER NOT NULL,
  ended_at INTEGER,
  digest_written INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_conv_user ON conversations(user_id, last_msg_at DESC);
CREATE INDEX idx_conv_pending_digest
  ON conversations(digest_written, last_msg_at)
  WHERE digest_written = 0;

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  embedded_cards TEXT,               -- JSON array
  edited_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

CREATE VIRTUAL TABLE messages_fts USING fts5(
  content, content=messages, content_rowid=rowid
);
```

---

## 3. 会话生命周期

| 状态 | 定义 |
|:---|:---|
| **active** | `last_msg_at > now - 30min` |
| **idle** | 30 min 无交互 · 未写 digest |
| **ended** | digest 已写 · 新消息将开一个新 conversation |

**一个 conversation = 一段连续对话**，不是"一个目标所有聊天"。这样 digest 才有清晰边界。

---

## 4. 接口

### 4.1 REST

| Method | Path | 说明 |
|:---|:---|:---|
| `POST` | `/api/conversations` | 创建新会话（可选 `contextGoalId`） |
| `GET` | `/api/conversations` | 列表（分页） |
| `GET` | `/api/conversations/:id` | 获取某会话 + 消息 |
| `POST` | `/api/conversations/:id/messages` | **SSE** 发送消息 + 流式返回 |
| `PATCH` | `/api/messages/:id` | 24h 内编辑 |
| `DELETE` | `/api/conversations/:id` | 删除会话（物理删 · 同步删 digest 条目） |

### 4.2 SSE 事件

```
event: user_ack
data: { "messageId": "..." }

event: token
data: { "delta": "你" }

event: token
data: { "delta": "好" }

event: card
data: { "type": "progress", "payload": {...} }

event: done
data: { "messageId": "...", "usage": {...} }

event: error
data: { "code": "LLM_TIMEOUT", "retryable": true }
```

---

## 5. 发送消息热路径

```
[api · POST /conversations/:id/messages]
  │
  ▼
1. 鉴权 · 找会话 (或创建)
  │
  ▼
2. 解析命令前缀
     · /新目标 → 进入 onboarding 简化流
     · /复盘   → 走 retro_request intent
     · /路线图 → 返回 card C4 直接响应
     · /进度   → 返回 card C1/C3
     · /归档   → 走 goal-tree 动作
     · 无前缀  → 普通消息
  │
  ▼
3. tx: INSERT message(role=user)
        UPDATE conversation.last_msg_at
  │
  ▼
4. SSE: event: user_ack
  │
  ▼
5. ctx = await context.build({ userId, conversationId, userMessage })
  │
  ▼
6. stream = llm.stream(ctx.systemPrompt, ctx.messages)
     for await (chunk of stream):
       SSE: event: token delta=chunk
       buffer += chunk
  │
  ▼
7. validation = persona.validateResponse(buffer)
     if !validation.ok:
       retry once with anti-cliche hint
       (丢弃前一次 SSE 的 token · 发 replace 事件)
  │
  ▼
8. card = await cardDecision.decide({ userMessage, history, activeGoals })
     if card:
       SSE: event: card payload
  │
  ▼
9. tx: INSERT message(role=assistant, content=buffer, embedded_cards=card)
  │
  ▼
10. SSE: event: done
  │
  ▼
11. emit event 'message.created' → worker 队列
     (digestWriter · personaCalibrator 异步消费)
```

### 5.1 事务化

- 步骤 3 用户消息写入必须在 SSE 返回前完成（零丢失）
- 步骤 9 AI 消息写入失败不影响用户消息（已入库）
- 步骤 7 retry 若失败仍返回原文，记一条警告日志

---

## 6. 命令前缀

| 前缀 | 行为 |
|:---|:---|
| `/新目标` | 创建 conversation · 进入简化建档状态机 |
| `/复盘` | intent = retro_request · 带最近 7 天 digests |
| `/路线图` | 立即返回 C4 全局摘要卡 · 不走 LLM |
| `/进度` | 返回当前 contextGoalId 的 C1 进度卡 |
| `/归档` | 触发 goal-tree.archiveCurrent · 二次确认 |

命令只在**输入开头**匹配，消息其余部分作为命令参数。

---

## 7. 消息编辑 / 删除

- 24h 内可编辑消息（`PATCH /api/messages/:id`）
- 编辑后 `edited_at` 更新，前端显示"已编辑"
- 编辑用户消息**不触发** AI 重生成（避免大量重算）
- 删除会话：`tx: DELETE FROM messages; DELETE FROM conversations;` + memory.forgetDigest

---

## 8. 回访开场（J2）

当用户打开 App：

```ts
function resolveOpeningMessage(user: User): Opening {
  const last = lastConversation(user);
  if (!last) return 'new_user';                // onboarding
  const hoursSince = (now - last.last_msg_at) / 3600;

  if (hoursSince < 24) return 'continue';      // 不重复问候
  if (hoursSince < 24 * 7) return 'reopen';    // 提及上次未决
  return 'reconnect';                          // 温和重连
}
```

对应的开场由 conversation 模块把 `openingHint` 传给 context.build，persona 据此生成首句。**不是硬编码文案**，人格决定具体怎么说。

---

## 9. 离线与错误

| 情况 | 前端 | 后端 |
|:---|:---|:---|
| 无网络 | 顶部横幅 · 输入禁用 · 本地暂存草稿 | — |
| SSE 中断 | 自动重连 · 续接 last messageId | 接续点查 messages 表 |
| LLM 超时 | 消息下出 retry 链接 | event: error code=LLM_TIMEOUT |
| LLM 失败 | "Let me think again" + retry | 保留用户消息 |
| Token 过期 | command bar 替换为登录 | 401 |

---

## 10. 性能指标

| 指标 | 目标 |
|:---|:---|
| 首字延迟 (TTFB token) | p95 < 1.5s |
| 用户消息持久化 | p95 < 20ms |
| SSE 建连 | < 100ms |
| 命令前缀响应（/路线图） | < 300ms |

---

## 11. 测试要点

- **单测**：命令解析 · resolveOpeningMessage · 事务化 · SSE 事件序列
- **集成**：假 LLM 模拟 token 流 + 失败 + 套话 → retry 路径
- **E2E**：用户发一条消息 → 看到 token 流 → 看到 card → 看到 done
- **压测**：100 并发 SSE · p95 首字 < 1.5s
- **崩溃测**：SSE 中途 kill worker · 客户端重连拿到完整消息

---

## 12. 风险

| 风险 | 缓解 |
|:---|:---|
| SSE 在某些代理下被缓冲 | Caddy 禁用 buffer · `X-Accel-Buffering: no` |
| LLM 生成中用户又发一条 | 队列化 · 前一条完成前新消息 queued（UI 显示"正在回应..."） |
| 命令前缀被正常消息误伤 | 只在行首严格匹配 · 有空格或其他字符退化为普通消息 |
| FTS5 索引膨胀 | 归档会话时清 fts5 行 |

---

## 13. 依赖

| 依赖 | 用于 |
|:---|:---|
| `context` | build packet |
| `persona` | validateResponse |
| `llm` | stream |
| `card` | decide |
| `memory` | forgetDigest（删除会话时） |
| `goal-tree` | 命令 `/归档` |
| `auth` | 鉴权中间件 |
