# LevelUp

Your growth companion — one who walked the road with you.

## What it is

A TypeScript monorepo implementing a conversational goal-management web app:

- **File-system memory** — persona, profile, digests, trends live as readable Markdown per user
- **DB-per-tenant physical isolation** — every user gets their own SQLite file; cross-tenant queries are impossible by schema construction
- **Open to local Claude Code via MCP** — bearer-token authenticated, scope-gated, per-tenant audited

## Repo layout

```
apps/
  api/            Fastify backend (system.db + tenant routing + SSE + MCP)
  web/            Next.js 15 frontend (minimal shell, working chat)

packages/
  shared/         Zod schemas, branded ids, errors
  tenancy/        TenantRegistry, TenantContext, provisioning, path safety
  memory/         File-system memory store (L1-L4)
  persona/        SOUL.md engine + anti-cliche filter + tone bands
  goal-tree/      Goal/Milestone/Action CRUD + GOALS.md projection
  llm/            Anthropic + fake client with unified streaming type
  context/        Intent classifier + parallel context assembly
  card/           Card decision engine
```

## Run it

```bash
pnpm install
pnpm -r typecheck
pnpm -r test

# Dev
cp .env.example .env           # fill ANTHROPIC_API_KEY optionally
pnpm --filter @levelup/api dev # :4000
pnpm --filter @levelup/web dev # :3000
```

Without an Anthropic key, the api falls back to a scripted fake LLM so the
full SSE path is exercisable in local dev.

## Docs

See `docs/` — `tech.md` is the architecture overview, each module has its own
`spec.md`.
