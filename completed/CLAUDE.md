# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-assisted customer inquiry management system (お問い合わせ対応) built with Next.js 16 + React 19. Customers submit inquiries via a public form; an LLM service (FastAPI+LangGraph) generates draft responses asynchronously; staff review, edit, and send responses via an admin dashboard. All UI text is in Japanese.

## Commands

### Next.js (web/)

```bash
cd web
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm start            # Run production server
npm run lint         # ESLint (Next.js + TypeScript rules)
npm run seed         # Seed database with sample data (clears existing data first)
npm run test:e2e     # Playwright E2E tests (auto-starts mock LLM + dev server)
npm run test:e2e:ui  # Playwright UI mode
```

Playwright E2E tests live in `web/e2e/` (see `web/e2e/README.md`). They cover the public form, the admin dashboard, all API routes, and the full inquiry lifecycle. The suite auto-starts a mock LLM server and the Next.js dev server via Playwright's `webServer`, and runs against an isolated DB (`web/data/e2e.db`) so it never touches the dev database. Chromium is the only browser project (`workers: 1`, serial). No unit-test framework is configured.

### FastAPI (llm-app/)

```bash
cd llm-app
uv sync                                          # Install dependencies
uv run fastapi dev                               # Start dev server at localhost:8000 (--reload enabled)
uv run ruff check .                              # Lint Python code
uv run mypy .                                    # Type check
```

Requires `ANTHROPIC_API_KEY` in `llm-app/.env` (see `.env.example`). Optional: `ANTHROPIC_MODEL` (defaults to claude-sonnet-5).

The Next.js app connects to FastAPI via `LLM_API_URL` env var (defaults to `http://localhost:8000`). The SQLite database path can be overridden with `INQUIRIES_DB_PATH` (used by both `db.ts` and `seed.ts`; defaults to `web/data/inquiries.db`) — this is the test seam the E2E suite uses to isolate its database.

## Architecture

### Two services

- **web/** — Next.js 16 App Router: public contact form (top page `/`), admin dashboard (`/admin`), API routes under `src/app/api/`, SQLite database via better-sqlite3 (WAL mode, auto-creates at `web/data/inquiries.db`)
- **llm-app/** — FastAPI + LangGraph: `POST /api/generate` runs the AI workflow

### Key files

- `web/src/lib/db.ts` — Database singleton, schema initialization, all CRUD operations; defines TypeScript types (`Inquiry`, `InquiryStatus`, `InquiryTopic`, `QualityScores`, `AIResponse`)
- `web/src/lib/llm.ts` — Calls FastAPI backend with 60s timeout; quality alert = politeness NG
- `web/src/app/api/inquiries/route.ts` — Uses Next.js 16 `after()` to trigger AI generation in background after returning immediate 200 to customer
- `llm-app/app/generate/graph.py` — LangGraph state machine definition and `GraphState` TypedDict

### LangGraph workflow (llm-app/)

3-node pipeline with conditional routing (`llm-app/app/generate/nodes/`):

```
classify_topic → [spam?] → END
                 [else] → generate_response → quality_check → END
```

- `classify_topic.py` — Claude classifies inquiry into product/development/other/spam with confidence score
- `generate_response.py` — Claude generates draft response (skipped for spam)
- `quality_check.py` — Claude evaluates politeness (OK/NG; skipped for spam)

### Inquiry lifecycle

`processing` → `draft` → `sent` (reply) or `closed` (spam reviewed by staff).
Generation failures become `error`; `draft` / `error` can be retried. Terminal states cannot be edited or retried.

1. Customer submits form → inquiry saved as `processing`, immediate 200 response
2. `after()` triggers LLM → AI generates response with quality scores → status becomes `draft`
3. Staff reviews on admin dashboard (list and selected detail refresh every 5s, preserving typed replies) → edits if needed → sends → `sent`
4. For spam, staff explicitly closes without a reply → `closed`. `updated_at` records closure time; `sent_at` remains null.
5. Fetch and mutation errors are shown in the UI without removing the editor. Completion messages survive detail refreshes.

### API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/inquiries` | Submit new inquiry (public) |
| GET | `/api/admin/inquiries` | List inquiries with status/topic filters, pagination |
| GET | `/api/admin/inquiries/[id]` | Get inquiry detail |
| POST | `/api/admin/inquiries/[id]/draft` | Save edited draft |
| POST | `/api/admin/inquiries/[id]/send` | Send response |
| POST | `/api/admin/inquiries/[id]/topic` | Update topic classification |
| POST | `/api/admin/inquiries/[id]/retry` | Re-run AI generation (sets status back to `processing`) |
| POST | `/api/admin/inquiries/[id]/close` | Close a draft spam inquiry without sending a reply |
| GET | `/api/health` | Proxy FastAPI health check (drives the connection-error modal) |

### UI stack

shadcn/ui components (in `web/src/components/ui/`) built on Radix UI primitives, styled with Tailwind CSS v4.

### Testing (E2E)

Playwright E2E tests in `web/e2e/` (`api/` for request-level tests, `ui/` for browser flows, `support/` for fixtures). Key design points:

- **Mock LLM** (`e2e/support/mock-llm.ts`) replaces the FastAPI backend that `after()` calls server-side (Playwright's browser-level network mocking can't intercept server-side fetches). It returns deterministic responses keyed by markers in the inquiry `content`: `[E2E:SPAM]`, `[E2E:NG]`, `[E2E:ERROR]` (otherwise a normal OK draft).
- **DB isolation** via `INQUIRIES_DB_PATH` pointing at `web/data/e2e.db`; `global-setup.ts` seeds it from `scripts/seed-data.yaml`.
- **Real-backend mode**: `E2E_REAL_LLM=1 npm run test:e2e` skips the mock and targets `http://localhost:8000`; marker-driven tests are tagged `@mock` and excluded via `grepInvert`.

## Path Aliases

TypeScript path alias `@/*` maps to `web/src/*` (configured in tsconfig.json).

### Book compatibility

Preserve the code printed in the book. In particular, the feedback API on page 308 requires `final_body: str` and checks only `ai_body` before computing edit distance. Closing spam is a web-only database update; feedback is sent only when a reply is sent. Keep the chapter10 send route aligned with completed.
