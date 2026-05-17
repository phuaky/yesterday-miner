# Yesterday Miner

Codex-backed harness for safe autonomous content and outreach operations.

Yesterday Miner is intentionally product-agnostic. The public repo contains the harness and a generic product template; real product specs, prospect lists, drafts, voice profiles, caches, and runtime state stay local and ignored.

**Default product spec:** `../product.md` via `PRODUCT_SPEC_PATH`
**Template:** `../templates/product.template.md`

## Two Lanes

1. **Personal lane** - configured X activity -> authentic post drafts
2. **Context lane** - configured Discord/community context -> product-aware drafts

Both feed the same Telegram approval inbox. Publishing only happens after explicit approval, content filtering, pre-publish checks, and a configurable STOP grace period.

## Quickstart

```bash
cd /Users/pky/No-AI/harness
cp .env.example .env   # fill in tokens and product/operator context
cp ../templates/product.template.md ../product.md
bun install

# one-time voice profile build from the configured X handle
bun ingest:voice

# end-to-end dry run (drafts to Telegram with [DRY] tag, no live X posts)
DRY_RUN=1 LOOKBACK_DAYS=3 bun ralph

# local verifier; no external API calls
bun verify
```

## Operator Dry-Run Demo

Use this before any live publishing. It proves the safety path locally, then sends one post draft and one manual Scout DM draft to Telegram when private inputs are filled.

```bash
cd /Users/pky/No-AI/harness
bun run demo:safety     # fake Telegram, no external APIs
bun run demo:bootstrap  # creates ignored demo input placeholder if needed
bun run demo:ready      # validates ignored private inputs, no sends
bun run demo:send       # real Telegram dry-run, requires ignored demo/demo-input.json
bun run demo:run        # readiness + send, then waits for Telegram callbacks
bun run demo:operator   # guided send + bot + proof wait loop
bun run demo:proof      # verifies approval/STOP evidence after Telegram callbacks
bun run demo:status     # redacted current demo status and next command
```

See `docs/operator-dry-run-demo.md` for the exact private input shape.
Use `docs/demo.env.example` for the minimal dry-run `.env` shape.
`demo:ready` also blocks until `../product.md` has no unresolved §5 **What I need from you** handoff items.
The demo input `mineDate` must be yesterday's date for the operator dry run.
When blocked, `demo:ready` and `demo:status` write a redacted `handoff` list with each missing input's path and required format.
After drafts are sent, `demo:status` separates incomplete/failed Telegram sends, pending approval proof, and failed local verifier/safety gates, then prints the exact next command.

## Kill Switches

- `DRY_RUN=1` - drafts only, no X posts
- `KILL_SWITCH=1` - harness exits immediately on startup
- `DAILY_POST_CAP=N` - hard cap on posts per calendar day (default 5)
- `GRACE_PERIOD_SECONDS=60` - seconds Telegram STOP button remains active after approval

## Public vs Private

Tracked:

- Harness source
- Manifest
- Safety docs
- Generic product template
- Verifier

Ignored:

- `product.md`
- `products/`, `campaigns/`, `drafts/`, `private/`
- `.env`
- caches, logs, generated voice profiles, pending drafts, verifier output

## Module Map

```text
ralph.ts                    entry point + loop controller
parser/spec.ts              read/write 8-section product specs
ingest/x-fetch.ts           Apify -> cache/x/{date}.json
ingest/discord-fetch.ts     DiscordChatExporter -> cache/discord/{channel}/{date}.json
ingest/voice-profile.ts     build generated voice/profile.md
miner/day-walker.ts         iterate days, dispatch to lanes
miner/score.ts              interest rubric (Codex)
miner/compose-personal.ts   X moment -> post draft
miner/compose-context.ts    context moment -> product-aware draft
scout/candidates.ts         extract engaged-with profiles from X cache
scout/fit-score.ts          product-fit rubric
scout/dm-compose.ts         draft manual cold DM
telegram/bot.ts             long-poll handler, inline buttons
telegram/send.ts            outbound draft DM
publish/x-post.ts           post on approval
publish/safety.ts           cap + grace period + content filter
scripts/verify-harness      static and local safety checks
```
