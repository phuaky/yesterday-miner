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
