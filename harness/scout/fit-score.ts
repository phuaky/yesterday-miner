/**
 * Product-fit scoring for candidate prospects.
 * Pulls profile metadata via Apify (apidojo/twitter-user-scraper), then Codex-scores.
 */

import { ApifyClient } from "apify-client";
import { codexExec } from "../lib/codex-exec.ts";
import { candidateFitRubric } from "../lib/config.ts";
import type { Candidate } from "./candidates.ts";

const ACTOR_ID = "apidojo/twitter-user-scraper";

export type EnrichedCandidate = Candidate & {
  bio?: string;
  location?: string;
  followers?: number;
  following?: number;
  verified?: boolean;
};

export type ScoredCandidate = EnrichedCandidate & {
  fitScore: number; // 0-10
  fitReason: string;
};

export async function enrichCandidates(usernames: string[]): Promise<EnrichedCandidate[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN missing");
  const client = new ApifyClient({ token });
  const run = await client.actor(ACTOR_ID).call({
    twitterHandles: usernames,
    addUserInfo: true,
    tweetsDesired: 0,
  } as Record<string, unknown>);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const byUser = new Map<string, EnrichedCandidate>();
  for (const raw of items as Record<string, unknown>[]) {
    const author = (raw.author as Record<string, unknown> | undefined) ?? raw;
    const username = String(author.userName ?? author.username ?? "");
    if (!username) continue;
    if (byUser.has(username)) continue;
    byUser.set(username, {
      username,
      firstSeen: "",
      contexts: [],
      signalCount: 0,
      bio: String(author.description ?? author.bio ?? ""),
      location: String(author.location ?? ""),
      followers: Number(author.followers ?? author.followersCount ?? 0),
      following: Number(author.following ?? author.followingCount ?? 0),
      verified: Boolean(author.isBlueVerified ?? author.verified),
    });
  }
  return [...byUser.values()];
}

export async function scoreFit(candidates: EnrichedCandidate[]): Promise<ScoredCandidate[]> {
  if (candidates.length === 0) return [];
  const numbered = candidates.map((c, i) => `[${i}] @${c.username} | followers:${c.followers ?? "?"} | loc:${c.location ?? "?"} | verified:${c.verified ?? "?"} | bio: ${(c.bio ?? "").replace(/\n/g, " ").slice(0, 200)}`).join("\n");

  const prompt = `${candidateFitRubric()}

Score each candidate. One JSON object per line, no commentary, no fences:
{"index": N, "score": 0-10, "reason": "one short sentence"}

CANDIDATES:
${numbered}`;

  const raw = await codexExec(prompt, { reasoning: "low", timeoutMs: 120_000 });
  const out: ScoredCandidate[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed) as { index: number; score: number; reason: string };
      const c = candidates[obj.index];
      if (!c) continue;
      out.push({ ...c, fitScore: obj.score, fitReason: obj.reason });
    } catch { /* ignore */ }
  }
  return out.sort((a, b) => b.fitScore - a.fitScore);
}
