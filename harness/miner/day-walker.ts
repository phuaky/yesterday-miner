/**
 * The Ralph loop: iterate days [yesterday → N_days_ago], score, compose, send to Telegram.
 * Both lanes (personal/X + context/Discord) run per day, parallelized in batches of 3 days.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { scoreXDay, scoreDiscordDay, type ScoredMoment } from "./score.ts";
import { composePersonal } from "./compose-personal.ts";
import { composeContext } from "./compose-context.ts";
import { registerDraft } from "../telegram/bot.ts";
import { sendDraft, draftId, type Draft } from "../telegram/send.ts";
import { contentFilter } from "../publish/safety.ts";
import type { RawTweet } from "../ingest/x-fetch.ts";
import type { DiscordMessage } from "../ingest/discord-fetch.ts";

const X_CACHE = `${import.meta.dir}/../cache/x`;
const DISCORD_CACHE = `${import.meta.dir}/../cache/discord`;

const PERSONAL_MIN_SCORE = 6;
const CONTEXT_MIN_SCORE = 5;

export type WalkerOptions = {
  days: number;
  lanes: Array<"personal" | "context">;
  batchSize?: number;
};

function dayList(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  }
  return out;
}

function loadXDay(day: string): RawTweet[] {
  const path = `${X_CACHE}/${day}.json`;
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as RawTweet[]) : [];
}

function loadDiscordDay(day: string): DiscordMessage[] {
  if (!existsSync(DISCORD_CACHE)) return [];
  const all: DiscordMessage[] = [];
  for (const channel of readdirSync(DISCORD_CACHE)) {
    const channelDir = `${DISCORD_CACHE}/${channel}`;
    for (const file of readdirSync(channelDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const parsed = JSON.parse(readFileSync(`${channelDir}/${file}`, "utf8")) as { messages: DiscordMessage[] };
        for (const m of parsed.messages ?? []) {
          if (m.timestamp?.slice(0, 10) === day) all.push(m);
        }
      } catch { /* skip malformed */ }
    }
  }
  return all;
}

async function processDay(day: string, lanes: WalkerOptions["lanes"]): Promise<void> {
  console.log(`\n=== ${day} ===`);

  if (lanes.includes("personal")) {
    const tweets = loadXDay(day);
    if (tweets.length === 0) {
      console.log(`  [personal] no X data for ${day}`);
    } else {
      console.log(`  [personal] scoring ${tweets.length} items…`);
      const scored = await scoreXDay(tweets);
      const top = scored[0];
      if (!top || top.score < PERSONAL_MIN_SCORE) {
        console.log(`  [personal] top score ${top?.score ?? "n/a"} < ${PERSONAL_MIN_SCORE}, skipping`);
      } else {
        console.log(`  [personal] top moment (${top.score}/10): ${top.reason}`);
        const body = await composePersonal(top, day);
        const f = contentFilter(body);
        if (!f.ok) {
          console.log(`  [personal] filtered out: ${f.reason}`);
        } else {
          const id = draftId({ lane: "personal", date: day, body });
          const draft: Draft = { id, lane: "personal", date: day, body, meta: { score: top.score, reason: top.reason } };
          registerDraft(draft);
          await sendDraft(draft);
          console.log(`  [personal] sent draft ${id} → Telegram`);
        }
      }
    }
  }

  if (lanes.includes("context")) {
    const messages = loadDiscordDay(day);
    if (messages.length === 0) {
      console.log(`  [context] no Discord data for ${day}`);
    } else {
      console.log(`  [context] scoring ${messages.length} messages…`);
      const scored = await scoreDiscordDay(messages);
      const eligible = scored.filter((m) => m.score >= CONTEXT_MIN_SCORE);
      if (eligible.length === 0) {
        console.log(`  [context] no moments >= ${CONTEXT_MIN_SCORE}`);
      } else {
        console.log(`  [context] ${eligible.length} eligible moments`);
        const body = await composeContext(eligible, day);
        const f = contentFilter(body);
        if (!f.ok) {
          console.log(`  [context] filtered out: ${f.reason}`);
        } else {
          const id = draftId({ lane: "context", date: day, body });
          const draft: Draft = { id, lane: "context", date: day, body, meta: { score: eligible[0]!.score } };
          registerDraft(draft);
          await sendDraft(draft);
          console.log(`  [context] sent draft ${id} -> Telegram`);
        }
      }
    }
  }
}

export async function walk(opts: WalkerOptions): Promise<void> {
  const days = dayList(opts.days);
  const batchSize = opts.batchSize ?? 3;

  for (let i = 0; i < days.length; i += batchSize) {
    const batch = days.slice(i, i + batchSize);
    await Promise.all(batch.map((d) => processDay(d, opts.lanes).catch((e) => console.error(`[${d}] ${e}`))));
  }
}

if (import.meta.main) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 7;
  const laneArg = process.argv.indexOf("--lanes");
  const lanesRaw = laneArg > 0 ? process.argv[laneArg + 1] : "personal,context";
  const lanes = lanesRaw!.split(",").filter((l) => l === "personal" || l === "context") as WalkerOptions["lanes"];
  console.log(`Walking ${days} days, lanes: ${lanes.join(", ")}`);
  await walk({ days, lanes });
}
