# Yesterday Miner State Map

Date: 2026-05-17

## Source-Controlled State

| Path | Role | Notes |
|---|---|---|
| `templates/product.template.md` | Public product-spec template | Safe example of the 8-section loop. |
| `harness/harness.manifest.json` | Harness contract | Commands, env vars, inputs, outputs, state files, side effects, and safety gates. |
| `harness/README.md` | Operator guide | Quickstart, kill switches, and module map. |
| `harness/scripts/verify-harness` | Local verifier | Writes ignored verification output. |
| `harness/docs/*.md` | Public architecture docs | Safety, events, state ownership, readiness. |

## Ignored Private State

| Path | Owner | Policy |
|---|---|---|
| `product.md` | Local operator | Product source of truth for a real campaign. |
| `products/` | Local operator | Optional product specs or variants. |
| `campaigns/` | Local operator | Private campaign instances, trackers, terms, and drafts. |
| `drafts/` | Local operator | Draft copy and notes. |
| `private/` | Local operator | Any sensitive supporting material. |
| `*.private.md`, `*.local.md` | Local operator | Ad hoc private files. |

## Ignored Runtime State

| Path | Owner | Policy |
|---|---|---|
| `.env` | Local operator | Secret config. Verifier checks keys only and never prints values. |
| `cache/x/{date}.json` | Ingest | Generated X cache. Safe to delete and regenerate. |
| `cache/discord/{channel}/{date}.json` | Ingest | Generated Discord cache. Safe to delete and regenerate if source remains available. |
| `cache/pending-drafts.json` | Telegram bot | Runtime approval queue. Do not commit. |
| `cache/stop-flags.json` | Telegram bot | Runtime cancel state. Do not commit. |
| `cache/post-counter.json` | Publish guard | Runtime daily post count. Do not commit. |
| `voice/profile.md` | Voice ingest | Generated voice anchor. Do not commit. |
| `voice/corpus.jsonl` | Voice ingest | Generated source corpus. Do not commit. |
| `log/` | Runtime | Local logs. Do not commit. |
| `test-results/.last-run.json` | Verifier | Latest verification evidence. Do not commit. |

## External State

| Surface | Role | Guardrail |
|---|---|---|
| Telegram approval inbox | Human review surface | Required before any publish path. |
| X account | Live publishing target | Protected by approval, grace window, daily cap, content filter, and dry-run. |
| Product tracker | Outreach source and status tracker | Must satisfy readiness gate before scale. |
| Apify | X data ingestion | Requires token; writes generated cache. |
| Discord exporter | Context ingestion | Optional lane; writes generated cache. |
| Codex CLI | Scoring and drafting | Runs on cached/sanitized context and returns bounded text/JSON. |

## State Ownership Rules

- Source files define the reusable harness.
- Product files define local campaign intent and stay ignored.
- Runtime files capture operational state and stay ignored.
- External trackers remain the operational source for outreach status.
- Generated voice and cache files can support dry runs but must not be treated as canonical campaign evidence.
