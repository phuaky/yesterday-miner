# Operator Dry-Run Demo

Date: 2026-05-17

## Demo Promise

In under 5 minutes, an operator can send one X post draft and one manual Scout DM draft to Telegram, approve or stop the post path, and verify that `DRY_RUN=1` prevents live posting while Scout DMs remain manual-only.

## Safety Rehearsal

Run this first. It uses a fake Telegram bot and no external APIs.

```bash
cd /Users/pky/No-AI/harness
bun run demo:safety
```

Expected evidence:

- `test-results/demo-local-safety.json` has `"status": "pass"`.
- Approval enters the dry-run branch.
- STOP cancels during the grace window.
- Scout approve callbacks are blocked.
- `publishX` rejects when `DRY_RUN=1`.

## Operator Inputs

Optional bootstrap:

```bash
cd /Users/pky/No-AI/harness
bun run demo:bootstrap
```

This creates ignored `demo/demo-input.json` from `docs/demo-input.example.json` if it does not exist, then prints a redacted list of private fields to fill. It does not create real product, prospect, or credential content.

Fill `/Users/pky/No-AI/harness/.env`:

```text
TELEGRAM_BOT_TOKEN=<Telegram bot token>
TELEGRAM_CHAT_ID=<Telegram chat id>
OPENAI_API_KEY=<optional for AI composition; local template fallback runs without it>
PRODUCT_SPEC_PATH=product.md
PRODUCT_NAME=<private product name>
OPERATOR_NAME=<operator name>
TARGET_AUDIENCE=<one-line audience>
X_HANDLE=<operator X handle>
DRY_RUN=1
KILL_SWITCH=0
DAILY_POST_CAP=5
GRACE_PERIOD_SECONDS=10
```

The minimal dry-run shape is also tracked at `docs/demo.env.example`.

Fill `/Users/pky/No-AI/product.md` from `templates/product.template.md`. The demo readiness gate requires the 8-section loop to parse and requires §5 **What I need from you** to have no unresolved handoff items. Keep real product content in `product.md`; it is ignored.

Create ignored `/Users/pky/No-AI/harness/demo/demo-input.json`:

```json
{
  "mineDate": "2026-05-16",
  "postSignal": {
    "text": "<one yesterday signal from X, notes, or cache>",
    "score": 8,
    "reason": "<why this is worth drafting into a post>"
  },
  "scoutCandidate": {
    "username": "<prospect_x_username_without_at>",
    "bio": "<public bio or public context>",
    "followers": 0,
    "fitScore": 8,
    "fitReason": "<why this person is a fit>",
    "contexts": ["<public context URL or note>"]
  },
  "postDraft": "<optional: provide to skip OpenAI composition>",
  "dmDraft": "<optional: provide to skip OpenAI composition>"
}
```

`mineDate` must be yesterday's date for the operator dry run. Local fixture tests may set `DEMO_EXPECTED_MINE_DATE`, but operator runs should leave it unset.

If `postDraft` or `dmDraft` is omitted and `OPENAI_API_KEY` is available, the harness uses the AI composer. If `OPENAI_API_KEY` or `voice/profile.md` is absent, the dry-run demo falls back to short local drafts built only from `demo-input.json` and `.env` fields. The fallback is for proving the operator loop, not for live campaign quality.

You can copy the same shape from `docs/demo-input.example.json`. The file with real signal and prospect context belongs at `demo/demo-input.json`, which is ignored.

## Readiness Check

This checks private input shape and required env keys without sending Telegram messages:

```bash
cd /Users/pky/No-AI/harness
bun run demo:ready
```

Expected evidence:

- `test-results/demo-readiness.json` has `"status": "ready"` before `demo:send`.
- If blocked, it lists only missing key names, unresolved product-spec handoff item names, or missing JSON fields, never secret values.
- The readiness and status artifacts include a redacted `handoff` array with the exact path, input name, and required format for each missing human input.

## Send Demo Drafts

```bash
cd /Users/pky/No-AI/harness
bun run demo:send
```

Expected evidence:

- `test-results/demo-send-drafts.json` has `"status": "sent"`.
- Telegram receives one `personal` draft with a Post button.
- Telegram receives one `scout-lead` draft labeled manual DM only and without a Post button.
- No live X post is attempted.
- No Scout DM is auto-sent.

If setup is incomplete, the script prints only missing key names and missing file/field names. It does not print secret values or private product content.

You can also run the readiness and send steps together:

```bash
bun run demo:run
```

If readiness passes and drafts send, `demo:run` writes `test-results/demo-run.json` with `"status": "awaiting-approval"` and prints the exact Telegram callback steps.

For the full guided operator run, use:

```bash
bun run demo:operator
```

It runs readiness, sends the drafts, starts the Telegram bot, waits up to `DEMO_OPERATOR_TIMEOUT_SECONDS` seconds for the Telegram clicks, runs `demo:proof`, then writes `test-results/demo-operator.json`.
If the bot process exits before approval proof passes, the operator artifact is blocked at `bot-exited` with redacted exit metadata.

## Manual Approval Proof

With `bun run bot` running in another terminal:

1. Click `Post` on the `personal` draft.
2. During the grace window, either click `STOP` to prove cancellation or let it finish to receive the `[DRY] Would have posted` message.
3. Try approving the `scout-lead` draft only if a forged callback/test path is used; the normal UI has no Post button.

Callback evidence is written to ignored `test-results/telegram-approval-evidence.json`. It records event names, draft ids, lanes, dates, dry-run status, and safety booleans only. It does not record draft bodies, token values, product content, or prospect details.

Expected approval evidence for the dry run:

- `grace_period_started`
- either `dry_run_post` or `grace_cancelled`
- `livePublishAttempted` remains `false`
- `autoDmAttempted` remains `false`

Then run:

```bash
bun run demo:proof
```

Expected evidence:

- `test-results/demo-approval-proof.json` has `"status": "pass"`.
- `completionMode` is either `"dry-run-would-post"` or `"stop-cancelled"`.
- It verifies `demo-send-drafts.json` was sent in dry-run mode.
- It verifies callback evidence contains approval/STOP or dry-run-post events for the current sent post draft id after the current send artifact.
- `safetyEvidence.stopGraceWindowOffered` is `true`.
- `safetyEvidence.scoutManualOnlyRoute` is `true`.
- It verifies no live publish or auto-DM attempt happened.

Final local verifier:

```bash
bun scripts/verify-harness
```

At any point, run:

```bash
bun run demo:status
```

It writes ignored `test-results/demo-status.json` with the redacted current stage, remaining missing fields, and next command.
After readiness passes, `demo:status` distinguishes blocked/incomplete/failed Telegram sends, pending approval proof, and failed local verification gates. It points at `demo:send`, `demo:proof`, `verify-harness`, or `demo:safety` as appropriate.
