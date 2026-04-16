# P0 · MVP TODO

> 来源：[Notion 全局 Todo](https://www.notion.so/qhhdf/20260411-LevelUp-Todo-33f5097bfa3a8082bc74d6eb6ba3e088)
> 同步时间：2026-04-14

---

## 前端 · 交互补全与行为真实化

- [x] `packages/motion`：抽出 WordStream / AmbientHalo / CardPush / SidebarSlide / CommandBarRise / MilestoneFlash / ErrorPulse，reduced-motion 统一管理
- [x] Command Bar `⌘K` 全局可唤起（cmdk 接入 · 拼音首字母匹配）
- [x] Sidebar `⌘B` 折叠/展开双态驱动 · 持久化 localStorage · SSR 读 cookie
- [x] Goal Detail Drawer 全局 DrawerHost 栈 · 点击 Sidebar 目标 / 卡片 VIEW FULL PATH → 打开
- [x] Onboarding 建档 5 步对接后端（锚定 / 定义完成 / 拆里程碑 / 聚焦本周 / 绑定情境）
- [x] 主对话卡片完整 6 类渲染（progress / locate / status / summary / encourage / celebrate）
- [x] WordStream 应用到真正的 AI 消息流（当前 SSE token 直接落，没走 stagger）
- [x] 主题切换：22:00 顶栏提示横幅 · SSR 预置 cookie 防闪烁
- [x] `/settings` 对接后端：Profile · Persona slider · What I Remember · MCP Token · 导出 · 一键删除
- [x] 键盘快捷键 hub（⌘K / ⌘B / ⌘/ / Esc / ⌘Enter）
- [x] 视觉回归测试（Playwright 截图 diff 11 个路由关键帧）
- [x] 移动端 / 平板响应式断点

## 后端 · MVP 闭环

- [x] `apps/worker` 独立进程：digestWriter 轮询 + 失败重试
- [x] `packages/vector`：sqlite-vec 真实实现（替换 noopVectorStore）
- [x] `memory.searchDigests` 改走真实向量召回
- [x] `memory.forgetDigest` 同步向量库删除
- [x] 重要度衰减 job（每周一 04:00）
- [x] 每周聚合 job（周日 23:00）
- [x] 沉默检测 job（每小时）
- [x] 备份 job（每日 03:00 · VACUUM INTO + tar）
- [x] 归档 job（每月 1 日 · 90 天前 digest → archive）
- [x] 文件锁兜底：worker 和 api 共享 locks（proper-lockfile）
- [x] `conversation.resolveOpeningMessage`：根据 last_msg_at 返回 continue/reopen/reconnect

## 鉴权与账户

- [x] Lucia 正式接入（替换 dev-login）
- [x] Magic link 邮件登录
- [x] Google OAuth（@oslojs/oauth2 + state/nonce）
- [x] Session rolling renewal（剩余 <7d 自动续期）
- [x] 软删除墓碑清理：cron 30 天后物理 deprovision

## 实施意图

- [x] `packages/implementation-intention`：LLM 校验 + 重写
- [x] 失败计数触发 directness 校准 + 自动建议重写
- [x] 与 onboarding Step 5 对接

## 卡片密度细化

- [x] 同类 1h 去重持久化
- [x] C5 encourageCard 真实取 digest 里完成的动作
- [x] celebrate card 在 goal-tree.completeMilestone 后广播

## MCP Server 补齐

- [x] `log_progress` tool
- [x] `send_message` tool（P1 scope）
- [x] MCP Resources
- [x] Rate limit（per token · token-bucket · 60/min 读 · 20/min 写）
- [x] 标准 MCP 协议一致性（走官方 SDK）
- [x] `@levelup/mcp-proxy` npm 包
- [x] Settings Activity tab

## 部署

- [x] Dockerfile 实测通过
- [x] `docker compose up` 冒烟测试
- [x] Caddyfile 生产域名 + 自动 HTTPS
- [x] 恢复脚本 `scripts/restore-tenant.js`
- [x] 管理 CLI：admin list-tenants / delete-tenant / tenant-stats
- [x] `/healthz` 扩展

## 质量

- [x] ESLint 规则 `@levelup/no-cross-tenant` / `no-raw-path` / `no-hex-color` / `no-bold-700` / `no-emoji-in-jsx`
- [x] pnpm lint + CI（github actions）
- [x] 1000 条 LLM 输出样本 · validateResponse · 套话命中率 < 5%
- [x] 人格一致性测试（同 soul 同 question 10 次采样 · tone 方差 < 0.1）

## 已知 tech debt

- [x] Anthropic SDK prompt caching 用正确 TextBlockParam 重开
- [x] `conversation.tail(10)` 抽包
- [x] `context.buildContext` goals 段 goalsMd vs snapshots 二选一
- [x] `memoryStore.readRecentDigests` parser 加 fast-check
- [x] system.db migration 走版本表
- [x] tenantId 用户可见场景 lowercase
- [x] eventBus 跨模块广播
- [x] ScenesNav 生产构建按 env 隐藏
- [x] `/scenes/*` 对接真实后端数据源
