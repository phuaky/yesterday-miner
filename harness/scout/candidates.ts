/**
 * Extract DM candidates from the operator's X activity cache.
 * Sources: people who liked/replied/quoted/RT'd his posts in the lookback window.
 *
 * For v1 we work from what x-fetch.ts already cached. A deeper scout would
 * fan out to scrape each engaged tweet's likers — out of scope today.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { xHandle } from "../lib/config.ts";
import type { RawTweet } from "../ingest/x-fetch.ts";

const X_CACHE = `${import.meta.dir}/../cache/x`;

export type Candidate = {
  username: string;
  firstSeen: string;
  contexts: string[]; // tweet URLs where they engaged
  signalCount: number; // total interactions detected
};

export function extractCandidates(days: number): Candidate[] {
  if (!existsSync(X_CACHE)) return [];
  const sinceTs = Date.now() - days * 86400_000;
  const byUser = new Map<string, Candidate>();

  for (const file of readdirSync(X_CACHE)) {
    if (!file.endsWith(".json")) continue;
    const day = JSON.parse(readFileSync(`${X_CACHE}/${file}`, "utf8")) as RawTweet[];
    for (const t of day) {
      if (new Date(t.createdAt).getTime() < sinceTs) continue;
      // Replies to the operator from others are a warm engagement signal.
      if (t.isReply && t.authorUsername && t.authorUsername !== xHandle()) {
        const c = byUser.get(t.authorUsername) ?? {
          username: t.authorUsername,
          firstSeen: t.createdAt,
          contexts: [],
          signalCount: 0,
        };
        c.signalCount += 1;
        c.contexts.push(t.url);
        if (new Date(t.createdAt) < new Date(c.firstSeen)) c.firstSeen = t.createdAt;
        byUser.set(t.authorUsername, c);
      }
    }
  }

  return [...byUser.values()].sort((a, b) => b.signalCount - a.signalCount);
}

if (import.meta.main) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 30;
  const out = extractCandidates(days);
  console.log(`Found ${out.length} engaged candidates in last ${days} days`);
  for (const c of out.slice(0, 20)) {
    console.log(`  @${c.username} — ${c.signalCount} signals, first ${c.firstSeen.slice(0, 10)}`);
  }
}
