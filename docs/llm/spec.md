# LLM · 供应商抽象与流式

> 一道薄层，把 Anthropic / OpenAI 统一成同一个流式接口。

---

## 1. 目标

- 抽象双供应商（Anthropic 默认 · OpenAI 兜底）
- 统一流式 token 事件
- 失败重试 + 成本统计

**非目标**
- 不做 prompt caching 的复杂调度（由 SDK 提供）
- 不做模型路由（单一路由在 config）

---

## 2. 接口

```ts
export interface LLMClient {
  stream(input: StreamInput): AsyncIterable<LLMEvent>;
  complete(input: CompleteInput): Promise<string>;             // 非流式，摘要等用
  structured<T>(input: StructuredInput<T>): Promise<T>;        // JSON schema 输出
  embed(text: string | string[]): Promise<number[][]>;
}

interface StreamInput {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

type LLMEvent =
  | { type: 'token'; text: string }
  | { type: 'finish'; usage: TokenUsage; finishReason: string }
  | { type: 'error'; error: Error; retryable: boolean };

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}
```

---

## 3. 供应商实现

```
packages/llm/
├── index.ts              ← createLLMClient(config)
├── anthropic.ts
├── openai.ts
├── retry.ts              ← 指数回退
├── usage-meter.ts
└── types.ts
```

### 3.1 Anthropic（默认）

- 模型：`claude-sonnet-4-6` 对话 · `claude-haiku-4-5-20251001` 摘要
- Prompt caching：system prompt 自动打 `cache_control`
- Streaming：SSE `message_delta` 转 `LLMEvent.token`

### 3.2 OpenAI（兜底）

- 模型：`gpt-4.1` 对话 · `gpt-4.1-mini` 摘要
- Tool use 不启用
- Streaming 转换同上

---

## 4. 重试策略

```ts
const retryable = new Set([429, 500, 502, 503, 504]);
const schedule = [500, 1500, 4000];                // ms
const maxRetries = 2;
```

流式第一块失败：重试。中途断开：不重试（避免重复 token），直接抛错给 conversation 处理。

---

## 5. 成本统计

每次调用后写入 `data/usage.jsonl`：

```json
{ "ts": 1712825400, "userId": "u1", "model": "claude-sonnet-4-6", "input": 1823, "output": 412, "cachedInput": 1200 }
```

worker 每日聚合到 `data/usage-daily.json`，供运营观察。**不给终端用户展示**（PRD 反模式：无仪表盘）。

---

## 6. Abort

`AbortSignal` 全链路透传：用户断开 SSE → conversation cancel → llm cancel。Anthropic SDK 原生支持 signal，OpenAI 同。

---

## 7. 测试要点

- Mock 两家 SDK 产出相同 LLMEvent 序列
- Retry: 前两次 429 → 成功
- Abort 中途 → 下游收到 cancel
- Usage 累计正确

---

## 8. 依赖

- `@anthropic-ai/sdk`
- `openai`
