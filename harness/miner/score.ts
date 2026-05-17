/**
 * Interest scorer — given a day's raw moments, ranks them by post-worthiness.
 * Lane-specific rubrics. Returns top-K with reasons.
 */

import { codexExec } from "../lib/codex-exec.ts";
import { contextName, operatorName, productName, targetAudience } from "../lib/config.ts";
import type { RawTweet } from "../ingest/x-fetch.ts";
import type { DiscordMessage } from "../ingest/discord-fetch.ts";

export type ScoredMoment = {
  source: "x" | "discord";
  score: number; // 0-10
  reason: string;
  raw: unknown;
  excerpt: string;
};

function personalRubric(): string {
  return `Score 0-10 on post-worthiness for ${operatorName()}'s X audience (${targetAudience()}).

Higher score when:
- Specific moment, not abstract (had names, numbers, scenes)
- Contrarian or non-obvious take
- Builder-relevant (shipped something, debugged something, decision made)
- Has tension or surprise
- Could land as an authentic post within 280 chars

Lower score when:
- Generic, vague
- Pure retweet of someone else's idea with no operator-added point
- Boring transactional reply
- Already very short and self-contained (nothing to expand)`;
}

function contextRubric(): string {
  return `Score 0-10 on post-worthiness for context about ${contextName()} and ${productName()}.

Higher score when:
- Concrete event, person, change, customer signal, or use case
- Worth telling outsiders about (interesting community signal)
- Has a name, a number, a date, a quote
- Shows the kind of person who would care about the target product

Lower score when:
- Pure logistics (meeting at 3pm)
- Inside-baseball with no narrative
- Already public knowledge`;
}

export async function scoreXDay(tweets: RawTweet[]): Promise<ScoredMoment[]> {
  if (tweets.length === 0) return [];
  const numbered = tweets.map((t, i) => `[${i}] ${t.isReply ? "(reply) " : ""}${t.isRetweet ? "(RT) " : ""}${t.text.replace(/\n/g, " | ")}`).join("\n");

  const prompt = `${personalRubric()}

Below are ${tweets.length} items from one day of the operator's X activity. For each, return JSON:
{"index": N, "score": 0-10, "reason": "one short sentence"}

One JSON object per line. No commentary, no markdown fences. Skip items scoring under 3.

ITEMS:
${numbered}`;

  const out = await codexExec(prompt, { reasoning: "low", timeoutMs: 90_000 });
  return parseScoreLines(out, tweets, "x");
}

export async function scoreDiscordDay(messages: DiscordMessage[]): Promise<ScoredMoment[]> {
  if (messages.length === 0) return [];
  // dedupe + summarize: only score messages with content + skip near-empty
  const items = messages.filter((m) => m.content && m.content.length > 10).slice(0, 200);
  const numbered = items.map((m, i) => `[${i}] @${m.author.nickname ?? m.author.name}: ${m.content.replace(/\n/g, " | ").slice(0, 280)}`).join("\n");

  const prompt = `${contextRubric()}

Below are ${items.length} Discord messages from one day. For each, return JSON:
{"index": N, "score": 0-10, "reason": "one short sentence"}

One JSON object per line. No commentary, no markdown fences. Skip items scoring under 4.

MESSAGES:
${numbered}`;

  const out = await codexExec(prompt, { reasoning: "low", timeoutMs: 90_000 });
  return parseScoreLines(out, items, "discord");
}

function parseScoreLines<T>(raw: string, source: T[], src: "x" | "discord"): ScoredMoment[] {
  const out: ScoredMoment[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed) as { index: number; score: number; reason: string };
      const item = source[obj.index];
      if (!item) continue;
      out.push({
        source: src,
        score: obj.score,
        reason: obj.reason,
        raw: item,
        excerpt: excerptOf(item, src),
      });
    } catch { /* ignore malformed lines */ }
  }
  return out.sort((a, b) => b.score - a.score);
}

function excerptOf(item: unknown, src: "x" | "discord"): string {
  if (src === "x") {
    const t = item as RawTweet;
    return t.text;
  }
  const m = item as DiscordMessage;
  return `@${m.author.nickname ?? m.author.name}: ${m.content}`;
}
