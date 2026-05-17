/**
 * Outbound: send a draft to the operator with inline keyboard.
 * Draft IDs are short hashes — used as callback_data prefixes.
 */

import TelegramBot from "node-telegram-bot-api";
import { createHash } from "node:crypto";

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (bot) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  bot = new TelegramBot(token, { polling: false });
  return bot;
}

export type DraftLane = "personal" | "context" | "scout-lead";

export type Draft = {
  id: string;
  lane: DraftLane;
  date: string; // YYYY-MM-DD this draft was mined from
  body: string;
  meta?: Record<string, unknown>;
};

export function draftId(d: Pick<Draft, "lane" | "date" | "body">): string {
  return createHash("sha256")
    .update(`${d.lane}|${d.date}|${d.body}`)
    .digest("hex")
    .slice(0, 10);
}

export async function sendDraft(draft: Draft): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID missing");

  const tag = draft.lane === "personal" ? "🧠" : draft.lane === "context" ? "🧭" : "🎯";
  const dryTag = process.env.DRY_RUN === "1" ? " [DRY]" : "";
  const text = `${tag} *${draft.lane}* — mined from ${draft.date}${dryTag}\n\n${draft.body}`;

  await getBot().sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Post", callback_data: `approve:${draft.id}` },
          { text: "✏️ Edit", callback_data: `edit:${draft.id}` },
        ],
        [
          { text: "🔁 Redraft", callback_data: `redraft:${draft.id}` },
          { text: "❌ Skip", callback_data: `skip:${draft.id}` },
        ],
      ],
    },
  });
}

export async function sendCancelable(draftId: string, graceSeconds: number): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  await getBot().sendMessage(
    chatId,
    `⏱ Posting in ${graceSeconds}s. Hit STOP to cancel.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "🛑 STOP", callback_data: `stop:${draftId}` }]],
      },
    },
  );
}

export async function sendInfo(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  await getBot().sendMessage(chatId, text);
}
