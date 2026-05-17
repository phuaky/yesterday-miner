/**
 * Fetch the configured X handle's recent activity via Apify (apidojo/twitter-user-scraper).
 * Writes per-day JSON to cache/x/{YYYY-MM-DD}.json grouping tweets, replies, likes.
 *
 * One-shot: `bun ingest/x-fetch.ts --days 30`
 */

import { ApifyClient } from "apify-client";
import { mkdirSync, writeFileSync } from "node:fs";
import { xHandle } from "../lib/config.ts";

const ACTOR_ID = "apidojo/twitter-user-scraper";

export type RawTweet = {
  id: string;
  url: string;
  createdAt: string;
  text: string;
  isReply: boolean;
  isRetweet: boolean;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  inReplyToId?: string;
  conversationId?: string;
  authorUsername?: string;
};

export async function fetchUserActivity(handle: string, days: number): Promise<RawTweet[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN missing");
  const client = new ApifyClient({ token });

  const sinceDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const run = await client.actor(ACTOR_ID).call({
    twitterHandles: [handle],
    sort: "Latest",
    tweetsDesired: Math.max(500, days * 20),
    onlyVerifiedUsers: false,
    onlyTwitterBlue: false,
    onlyImage: false,
    onlyVideo: false,
    onlyQuote: false,
    addUserInfo: true,
    startUrls: [],
    start: sinceDate,
  } as Record<string, unknown>);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items.map((it) => normalize(it as Record<string, unknown>));
}

function normalize(raw: Record<string, unknown>): RawTweet {
  // apidojo/twitter-user-scraper field shapes vary by actor version; defensive picks.
  const author = (raw.author as Record<string, unknown> | undefined) ?? {};
  return {
    id: String(raw.id ?? raw.tweetId ?? raw.conversationId ?? ""),
    url: String(raw.url ?? raw.twitterUrl ?? ""),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    text: String(raw.text ?? raw.fullText ?? ""),
    isReply: Boolean(raw.isReply ?? raw.inReplyToId),
    isRetweet: Boolean(raw.isRetweet ?? raw.retweetedStatus),
    likeCount: Number(raw.likeCount ?? raw.favoriteCount ?? 0),
    retweetCount: Number(raw.retweetCount ?? 0),
    replyCount: Number(raw.replyCount ?? 0),
    quoteCount: Number(raw.quoteCount ?? 0),
    inReplyToId: raw.inReplyToId ? String(raw.inReplyToId) : undefined,
    conversationId: raw.conversationId ? String(raw.conversationId) : undefined,
    authorUsername: author.userName ? String(author.userName) : (raw.authorUsername as string | undefined),
  };
}

/** Group a flat tweet array into per-day buckets keyed by YYYY-MM-DD. */
export function bucketByDay(tweets: RawTweet[]): Record<string, RawTweet[]> {
  const out: Record<string, RawTweet[]> = {};
  for (const t of tweets) {
    if (!t.createdAt) continue;
    const day = new Date(t.createdAt).toISOString().slice(0, 10);
    (out[day] ??= []).push(t);
  }
  return out;
}

export function writeCache(buckets: Record<string, RawTweet[]>): string[] {
  const dir = `${import.meta.dir}/../cache/x`;
  mkdirSync(dir, { recursive: true });
  const paths: string[] = [];
  for (const [day, tweets] of Object.entries(buckets)) {
    const path = `${dir}/${day}.json`;
    writeFileSync(path, JSON.stringify(tweets, null, 2));
    paths.push(path);
  }
  return paths;
}

if (import.meta.main) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 30;
  const handle = xHandle();
  console.log(`Fetching @${handle} last ${days} days via Apify…`);
  const tweets = await fetchUserActivity(handle, days);
  console.log(`Got ${tweets.length} items. Bucketing by day…`);
  const buckets = bucketByDay(tweets);
  const paths = writeCache(buckets);
  console.log(`Wrote ${paths.length} day-buckets:`);
  for (const p of paths) console.log(`  ${p}`);
}
