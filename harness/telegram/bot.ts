/**
 * Long-poll bot — handles approval callbacks and edit replies.
 * Run separately: `bun telegram/bot.ts`
 *
 * State: in-memory draft registry, plus on-disk pending file for restart resilience.
 */

import TelegramBot from "node-telegram-bot-api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Draft } from "./send.ts";
import { publishX } from "../publish/x-post.ts";
import { checkPrePublish, contentFilter, gracePeriodSeconds, recordPublish } from "../publish/safety.ts";
import { appendLog } from "../parser/spec.ts";
import { productSpecPath } from "../lib/config.ts";

const PENDING_PATH = `${import.meta.dir}/../cache/pending-drafts.json`;
const STOPS_PATH = `${import.meta.dir}/../cache/stop-flags.json`;
const APPROVAL_EVIDENCE_PATH = `${import.meta.dir}/../test-results/telegram-approval-evidence.json`;
const SPEC_PATH = productSpecPath();

type Pending = Record<string, Draft>;
type ApprovalEvidenceEvent = {
  at: string;
  event: string;
  draftId: string;
  lane?: Draft["lane"];
  date?: string;
  dryRun: boolean;
  livePublishAttempted: boolean;
  autoDmAttempted: boolean;
  detail?: string;
};

function loadPending(): Pending {
  if (!existsSync(PENDING_PATH)) return {};
  try { return JSON.parse(readFileSync(PENDING_PATH, "utf8")); } catch { return {}; }
}
function savePending(p: Pending): void {
  mkdirSync(dirname(PENDING_PATH), { recursive: true });
  writeFileSync(PENDING_PATH, JSON.stringify(p, null, 2));
}

function loadStops(): Record<string, boolean> {
  if (!existsSync(STOPS_PATH)) return {};
  try { return JSON.parse(readFileSync(STOPS_PATH, "utf8")); } catch { return {}; }
}
function saveStops(s: Record<string, boolean>): void {
  mkdirSync(dirname(STOPS_PATH), { recursive: true });
  writeFileSync(STOPS_PATH, JSON.stringify(s));
}

function appendApprovalEvidence(event: Omit<ApprovalEvidenceEvent, "at" | "dryRun">): void {
  mkdirSync(dirname(APPROVAL_EVIDENCE_PATH), { recursive: true });
  const current = existsSync(APPROVAL_EVIDENCE_PATH)
    ? safeReadEvidence()
    : { status: "recorded", events: [] as ApprovalEvidenceEvent[] };
  current.events.push({
    at: new Date().toISOString(),
    dryRun: process.env.DRY_RUN === "1",
    ...event,
  });
  writeFileSync(APPROVAL_EVIDENCE_PATH, `${JSON.stringify(current, null, 2)}\n`);
}

function safeReadEvidence(): { status: string; events: ApprovalEvidenceEvent[] } {
  try {
    const parsed = JSON.parse(readFileSync(APPROVAL_EVIDENCE_PATH, "utf8")) as { status?: string; events?: ApprovalEvidenceEvent[] };
    return {
      status: parsed.status ?? "recorded",
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { status: "recorded", events: [] };
  }
}

export function registerDraft(d: Draft): void {
  const p = loadPending();
  p[d.id] = d;
  savePending(p);
}

function appendSpecLog(entry: string): void {
  if (!existsSync(SPEC_PATH)) return;
  appendLog(SPEC_PATH, entry);
}

function reportRedactedError(scope: string): void {
  console.error(`${scope}; details redacted.`);
}

export async function handleCallback(bot: TelegramBot, q: TelegramBot.CallbackQuery): Promise<void> {
  const data = q.data ?? "";
  const [action, id] = data.split(":");
  const chatId = q.message?.chat.id;
  if (!chatId || !action || !id) return;

  const pending = loadPending();
  const draft = pending[id];

  if (action === "stop") {
    if (!draft) {
      await bot.answerCallbackQuery(q.id, { text: "Draft not found." });
      return;
    }

    const stops = loadStops();
    stops[id] = true;
    saveStops(stops);
    appendApprovalEvidence({
      event: "stop_requested",
      draftId: id,
      lane: draft?.lane,
      date: draft?.date,
      livePublishAttempted: false,
      autoDmAttempted: false,
    });
    await bot.answerCallbackQuery(q.id, { text: "🛑 STOPPED" });
    await bot.sendMessage(chatId, `Cancelled draft ${id}.`);
    return;
  }

  if (!draft) {
    await bot.answerCallbackQuery(q.id, { text: "Draft not found." });
    return;
  }

  if (action === "skip") {
    delete pending[id];
    savePending(pending);
    appendSpecLog(`[skip] ${draft.lane} draft ${id} (mined ${draft.date})`);
    await bot.answerCallbackQuery(q.id, { text: "Skipped." });
    return;
  }

  if (action === "edit") {
    await bot.answerCallbackQuery(q.id, { text: "Reply to this message with your edit." });
    await bot.sendMessage(chatId, `✏️ Reply with edited draft for ${id}:\n\n${draft.body}`, {
      reply_markup: { force_reply: true },
    });
    return;
  }

  if (action === "redraft") {
    await bot.answerCallbackQuery(q.id, { text: "Redraft requested (manual for v1)." });
    appendSpecLog(`[redraft-requested] ${draft.lane} draft ${id} (mined ${draft.date})`);
    return;
  }

  if (action === "approve") {
    if (draft.lane === "scout-lead") {
      appendApprovalEvidence({
        event: "scout_dm_approve_blocked",
        draftId: id,
        lane: draft.lane,
        date: draft.date,
        livePublishAttempted: false,
        autoDmAttempted: false,
      });
      await bot.answerCallbackQuery(q.id, { text: "Scout DMs are manual-only." });
      appendSpecLog(`[manual-dm-only] blocked approve callback for scout draft ${id}`);
      return;
    }

    const filter = contentFilter(draft.body);
    if (!filter.ok) {
      appendApprovalEvidence({
        event: "publish_blocked_content_filter",
        draftId: id,
        lane: draft.lane,
        date: draft.date,
        livePublishAttempted: false,
        autoDmAttempted: false,
        detail: filter.reason,
      });
      await bot.answerCallbackQuery(q.id, { text: `Blocked: ${filter.reason}` });
      return;
    }
    const guard = checkPrePublish();
    if (guard) {
      appendApprovalEvidence({
        event: "publish_blocked_pre_publish",
        draftId: id,
        lane: draft.lane,
        date: draft.date,
        livePublishAttempted: false,
        autoDmAttempted: false,
        detail: guard,
      });
      await bot.answerCallbackQuery(q.id, { text: `Blocked: ${guard}` });
      return;
    }

    appendApprovalEvidence({
      event: "grace_period_started",
      draftId: id,
      lane: draft.lane,
      date: draft.date,
      livePublishAttempted: false,
      autoDmAttempted: false,
      detail: `${gracePeriodSeconds()}s`,
    });
    await bot.answerCallbackQuery(q.id, { text: "Approved — grace period started" });
    await bot.sendMessage(chatId, `⏱ Posting ${id} in ${gracePeriodSeconds()}s. Hit STOP to cancel.`, {
      reply_markup: { inline_keyboard: [[{ text: "🛑 STOP", callback_data: `stop:${id}` }]] },
    });

    setTimeout(async () => {
      const stops = loadStops();
      if (stops[id]) {
        delete stops[id]; saveStops(stops);
        appendApprovalEvidence({
          event: "grace_cancelled",
          draftId: id,
          lane: draft.lane,
          date: draft.date,
          livePublishAttempted: false,
          autoDmAttempted: false,
        });
        appendSpecLog(`[grace-cancel] ${draft.lane} draft ${id} cancelled during grace`);
        await bot.sendMessage(chatId, `🛑 Cancelled before publish: ${id}`);
        return;
      }

      if (process.env.DRY_RUN === "1") {
        appendApprovalEvidence({
          event: "dry_run_post",
          draftId: id,
          lane: draft.lane,
          date: draft.date,
          livePublishAttempted: false,
          autoDmAttempted: false,
        });
        await bot.sendMessage(chatId, `[DRY] Would have posted: ${draft.body.slice(0, 80)}…`);
        appendSpecLog(`[dry-run-post] ${draft.lane} draft ${id} (mined ${draft.date})`);
      } else {
        try {
          const url = await publishX(draft.body);
          recordPublish();
          appendApprovalEvidence({
            event: "live_posted",
            draftId: id,
            lane: draft.lane,
            date: draft.date,
            livePublishAttempted: true,
            autoDmAttempted: false,
          });
          appendSpecLog(`[posted] ${draft.lane} draft ${id} (mined ${draft.date}) -> ${url}`);
          await bot.sendMessage(chatId, `✅ Posted: ${url}`);
        } catch {
          appendApprovalEvidence({
            event: "live_publish_failed",
            draftId: id,
            lane: draft.lane,
            date: draft.date,
            livePublishAttempted: true,
            autoDmAttempted: false,
            detail: "publish threw",
          });
          appendSpecLog(`[post-failed] ${draft.lane} draft ${id}: publish threw`);
          await bot.sendMessage(chatId, "❌ Post failed; details redacted. Check operator setup and X credentials.");
        }
      }

      const pending2 = loadPending();
      delete pending2[id];
      savePending(pending2);
    }, gracePeriodSeconds() * 1000);
  }
}

if (import.meta.main) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.error("TELEGRAM_BOT_TOKEN missing"); process.exit(1); }
  const bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot polling. DRY_RUN=", process.env.DRY_RUN ?? "0");
  bot.on("polling_error", () => reportRedactedError("Telegram polling error"));
  bot.on("callback_query", (q) => handleCallback(bot, q).catch(() => reportRedactedError("Telegram callback handler failed")));
  bot.on("message", (m) => {
    // edit-reply handler — placeholder; v1 logs and treats as approval
    if (m.reply_to_message?.text?.startsWith("✏️ Reply with edited draft for")) {
      const idMatch = m.reply_to_message.text.match(/for ([0-9a-f]{10}):/);
      const id = idMatch?.[1];
      if (id && m.text) {
        const p = loadPending();
        if (p[id]) {
          p[id].body = m.text;
          savePending(p);
          const next = p[id].lane === "scout-lead"
            ? "Copy/send manually outside the harness."
            : "Use the Telegram Post button to approve when ready.";
          bot.sendMessage(m.chat.id, `Edit saved for ${id}. ${next}`);
        }
      }
    }
  });
}
