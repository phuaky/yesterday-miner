/**
 * Post a tweet to the configured X handle via Twitter API v2 (OAuth 1.0a, write-enabled).
 * Returns canonical tweet URL on success.
 */

import { TwitterApi } from "twitter-api-v2";

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (client) return client;
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    throw new Error("X_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_TOKEN_SECRET required");
  }
  client = new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
  return client;
}

export async function publishX(text: string): Promise<string> {
  const c = getClient().readWrite;
  const res = await c.v2.tweet(text);
  const handle = process.env.X_HANDLE ?? "your_handle";
  return `https://x.com/${handle}/status/${res.data.id}`;
}
