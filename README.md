# Yesterday Miner

Product-agnostic harness for mining yesterday's signals, drafting posts or manual outreach, and routing every risky action through a human approval loop.

The repo is designed to keep the reusable system public while the actual product, prospects, drafts, credentials, caches, and runtime evidence stay local and ignored.

## What It Does

- Mines configured X and community context for useful moments.
- Scores those moments against a private product spec.
- Drafts post ideas and manual Scout DM copy.
- Sends drafts to a Telegram approval inbox.
- Publishes to X only after explicit approval, content filtering, pre-publish checks, a daily cap, and a STOP grace period.
- Keeps Scout DMs manual-only; the harness never sends cold DMs to prospects.

## Repo Layout

```text
harness/                       Bun source, scripts, docs, and verifier
harness/README.md              Detailed operator and module guide
harness/docs/                  Safety, event, readiness, and demo docs
templates/product.template.md  Public 8-section product spec template
README.md                      Project overview
```

Private runtime files such as `product.md`, `.env`, `campaigns/`, `drafts/`, `harness/cache/`, `harness/demo/`, `harness/voice/`, `harness/log/`, and `harness/test-results/` are ignored.

## Quick Start

```bash
cd harness
cp .env.example .env
cp ../templates/product.template.md ../product.md
bun install
```

Fill `harness/.env` and the private `product.md`, then run:

```bash
bun run verify
DRY_RUN=1 LOOKBACK_DAYS=3 bun run ralph
```

For the safer guided operator rehearsal, start with:

```bash
bun run demo:safety
bun run demo:bootstrap
bun run demo:ready
bun run demo:send
bun run demo:proof
```

The full demo walkthrough lives in `harness/docs/operator-dry-run-demo.md`.

## Product Spec Loop

Every real product should use the 8-section loop from `templates/product.template.md`:

```text
Goal -> Done -> Observe -> Think -> Plan -> Execute -> Verify -> Reflect-if-passed
```

Section 5 separates handoffs into:

- `What I need from you`
- `My next steps`
- `Your parallel work`

Sections 6 and 7 loop until verification passes. Section 8 stays empty until then.

## Safety Model

The harness assumes live publishing is dangerous by default.

- `DRY_RUN=1` blocks live X posts and sends dry-run Telegram drafts.
- `KILL_SWITCH=1` stops the harness before work begins.
- `DAILY_POST_CAP` limits live posts per day.
- `GRACE_PERIOD_SECONDS` gives the operator a STOP window after approval.
- Telegram approval is the only path to `publishX`.
- Scout drafts are routed to Telegram as manual DM copy, never auto-sent.
- Verifiers check ignored private state, approval gates, redacted evidence, and demo readiness.

## Common Commands

Run from `harness/`:

```bash
bun run verify          # static and local safety checks
bun run demo:safety     # fake Telegram safety rehearsal, no external APIs
bun run demo:status     # redacted current setup status and next command
bun run bot             # Telegram callback handler
bun run ingest:voice    # build ignored voice/profile.md from configured X history
bun run ralph           # default mining loop
```

## More Docs

- `harness/README.md` - operator guide and module map
- `harness/docs/operator-dry-run-demo.md` - dry-run demo steps and expected evidence
- `harness/docs/architecture.md` - product-agnostic architecture
- `harness/docs/readiness-gate.md` - readiness criteria before live operation
- `harness/harness.manifest.json` - command, env, input, output, state, and safety contract
