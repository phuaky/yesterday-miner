# Yesterday Miner Architecture

Date: 2026-05-17

## Purpose

Yesterday Miner is a product-agnostic Codex harness for safe autonomous content and outreach operations. It mines recent X and optional community context, drafts posts and manual DM candidates in an operator's voice, routes drafts to Telegram for approval, and publishes to X only after an explicit approval path.

The public repo contains the harness. Product-specific campaigns belong in ignored local files such as `product.md`, `campaigns/**`, and `drafts/**`.

## Operating Mapping

| Convention | Yesterday Miner equivalent | Current status |
|---|---|---|
| Current State -> Ideal State | 8-section product spec at `PRODUCT_SPEC_PATH` | Strong |
| Work artifact | `product.md` locally, `templates/product.template.md` publicly | Strong |
| Tool registry | `harness.manifest.json` commands and side effects | Strong |
| Skills/workflows/tools | Bun modules under `ingest/`, `miner/`, `scout/`, `telegram/`, `publish/`, `parser/` | Explicit modules |
| Hooks/events | CLI commands and Telegram callbacks | Event model documented in `docs/events.md` |
| Memory | Spec log, cache, pending drafts, voice profile, external tracker | State model documented in `docs/state-map.md` |
| Routing | `ralph.ts` command switch, day walker lanes, Telegram callback actions | Explicit |
| Verification | `scripts/verify-harness` | Local verifier |
| Containment | `.gitignore`, `.env` shape checks, generated/private state ignored | Strong |

## System Boundaries

Yesterday Miner has three layers:

- Source: TypeScript code, docs, manifest, template spec, and verifier committed in the repo.
- Private product state: `product.md`, `products/`, `campaigns/`, `drafts/`, and local trackers. These are ignored.
- Runtime state: `.env`, cache files, voice profile, pending drafts, counters, logs, and verifier output. These are ignored.
- External systems: Telegram, X, Apify, Discord exporter, Codex CLI, and optional trackers.

The verifier checks source and local state shape. It does not call external APIs, post to X, send DMs, or mutate campaign behavior.

## Safety Model

Live publishing is intentionally narrow:

1. A draft is registered in `cache/pending-drafts.json`.
2. Telegram sends the draft with inline actions.
3. Only the `approve` callback enters the publish path.
4. The content filter runs.
5. The pre-publish guard checks kill switch and daily cap.
6. A grace-period STOP window opens.
7. If `DRY_RUN=1`, the bot sends a would-post message and does not call X.
8. If `DRY_RUN!=1`, the bot calls `publishX` after the grace window and logs the result if a product spec exists.

Scout DMs are manual-only in v1. The harness drafts them; the operator sends them outside the harness.

## Non-Goals

- Do not commit private product specs, prospect lists, or message drafts.
- Do not auto-send cold DMs.
- Do not treat the public template as campaign evidence.
- Do not scale outreach until the product readiness gate is satisfied.

## Readiness Gate

Product scale must not begin until all of these are true:

- Tracker columns ready.
- First segment selected.
- Message templates reviewed by the operator.
- Required product links confirmed.
- Operator eligibility/authority confirmed.
- Daily send cap defined.
