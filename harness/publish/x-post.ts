/**
 * Post a tweet to the configured X handle via Twitter API v2 (OAuth 1.0a, write-enabled).
 * Returns canonical tweet URL on success.
 */

import { TwitterApi } from "twitter-api-v2";

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (client) return client;
  const xConsumerKey = process.env.X_CONSUMER_KEY ?? process.env.X_API_KEY;
  const xConsumerSecret = process.env.X_CONSUMER_SECRET ?? process.env.X_API_SECRET;
  const { X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!xConsumerKey || !xConsumerSecret || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    throw new Error("X_CONSUMER_KEY/X_CONSUMER_SECRET/X_ACCESS_TOKEN/X_ACCESS_TOKEN_SECRET required");
  }
  client = new TwitterApi({
    appKey: xConsumerKey,
    appSecret: xConsumerSecret,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
  return client;
}

export async function publishX(text: string): Promise<string> {
  if (process.env.DRY_RUN === "1") {
    throw new Error("DRY_RUN=1 blocks live X publish");
  }
  const c = getClient().readWrite;
  const res = await c.v2.tweet(text);
  const handle = process.env.X_HANDLE ?? "your_handle";
  return `https://x.com/${handle}/status/${res.data.id}`;
}
