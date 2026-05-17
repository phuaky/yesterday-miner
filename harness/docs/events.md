# Yesterday Miner Event Model

Date: 2026-05-17

## Event Flow

```text
operator command
  -> ralph.ts command router
  -> ingest / mine / scout / voice / bot
  -> cache or draft state
  -> Telegram approval inbox
  -> approve / edit / redraft / skip / stop
  -> dry-run would-post OR live publish
  -> product spec log and runtime state update
```

## Core Events

| Event | Producer | Consumer | Side effects |
|---|---|---|---|
| `ingest.x.completed` | `ingest/x-fetch.ts` | `miner/day-walker.ts`, `scout/candidates.ts` | Writes `cache/x/{date}.json`. |
| `ingest.discord.completed` | `ingest/discord-fetch.ts` | `miner/day-walker.ts` | Writes `cache/discord/{channel}/{date}.json`. |
| `voice.profile.updated` | `ingest/voice-profile.ts` | composers | Writes `voice/profile.md`. |
| `mine.started` | `ralph.ts` | product spec log, Telegram | Sends info message and appends Section 6 log if `PRODUCT_SPEC_PATH` exists. |
| `moment.scored` | `miner/score.ts` | composers | Uses Codex to score cached moments. |
| `draft.created` | composers / scout | Telegram queue | Registers pending draft and sends Telegram message. |
| `draft.approved` | Telegram callback | publish guard | Enters content filter and pre-publish checks. |
| `draft.stop_requested` | Telegram callback | grace timer | Cancels pending post during grace period. |
| `draft.skipped` | Telegram callback | product spec log | Removes draft and records skip if `PRODUCT_SPEC_PATH` exists. |
| `post.dry_run` | Telegram bot | Telegram / product spec log | Reports would-post; no X call. |
| `post.published` | Telegram bot | X / product spec log / counter | Calls X only after approval and grace period. |
| `post.failed` | Telegram bot | product spec log / Telegram | Records error without retrying automatically. |
| `verification.completed` | `scripts/verify-harness` | operator | Writes `test-results/.last-run.json`. |

## Blocking Gates

- `KILL_SWITCH=1` blocks command startup in `ralph.ts`.
- Missing Telegram config blocks draft delivery.
- `contentFilter` blocks unsafe or malformed post text.
- `checkPrePublish` blocks daily cap and kill-switch violations.
- `DRY_RUN=1` blocks the live X call after approval.
- STOP callback blocks publish during the grace window.

## Non-Events

- Scout does not send X DMs.
- Verification does not call external APIs.
- Product scale work does not begin until the readiness gate is satisfied.
