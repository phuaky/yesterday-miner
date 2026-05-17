/**
 * Wrap DiscordChatExporter CLI to dump configured Discord channels to JSON.
 *
 * Requires: `dotnet tool install -g DiscordChatExporter.Cli` (or `brew install --cask discord-chat-exporter-gui`)
 * Bin name: `discordchatexporter.cli` or `dce` (depending on install method).
 *
 * One-shot: `bun ingest/discord-fetch.ts --days 30`
 * Token & channel IDs from .env (DISCORD_USER_TOKEN, DISCORD_CHANNELS).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const BIN_CANDIDATES = ["dce", "discordchatexporter.cli", "DiscordChatExporter.Cli"];

function findBin(): string {
  for (const b of BIN_CANDIDATES) {
    const result = Bun.spawnSync(["which", b]);
    if (result.exitCode === 0) return b;
  }
  throw new Error(`DiscordChatExporter CLI not found. Install: dotnet tool install -g DiscordChatExporter.Cli`);
}

export async function exportChannel(channelId: string, days: number): Promise<string> {
  const token = process.env.DISCORD_USER_TOKEN;
  if (!token) throw new Error("DISCORD_USER_TOKEN missing");
  const bin = findBin();

  const dir = `${import.meta.dir}/../cache/discord/${channelId}`;
  mkdirSync(dir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = `${dir}/${today}.json`;

  const afterDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      bin,
      ["export", "-t", token, "-c", channelId, "-f", "Json", "--after", afterDate, "-o", outPath],
      { stdio: ["inherit", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`dce exit ${code}: ${stderr}`))));
  });

  return outPath;
}

export type DiscordMessage = {
  id: string;
  timestamp: string;
  author: { id: string; name: string; nickname?: string };
  content: string;
  attachments?: Array<{ url: string; fileName: string }>;
  reactions?: Array<{ emoji: { name: string }; count: number }>;
};

export function bucketByDay(messages: DiscordMessage[]): Record<string, DiscordMessage[]> {
  const out: Record<string, DiscordMessage[]> = {};
  for (const m of messages) {
    const day = new Date(m.timestamp).toISOString().slice(0, 10);
    (out[day] ??= []).push(m);
  }
  return out;
}

if (import.meta.main) {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 30;
  const channelsEnv = process.env.DISCORD_CHANNELS ?? "";
  const channels = channelsEnv.split(",").map((c) => c.trim()).filter(Boolean);
  if (channels.length === 0) {
    console.error("DISCORD_CHANNELS empty in .env (comma-separated channel IDs).");
    process.exit(1);
  }

  for (const ch of channels) {
    console.log(`Exporting channel ${ch} (last ${days}d)…`);
    const path = await exportChannel(ch, days);
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as { messages: DiscordMessage[] };
      const buckets = bucketByDay(parsed.messages ?? []);
      console.log(`  ${path} — ${parsed.messages?.length ?? 0} messages across ${Object.keys(buckets).length} days`);
    }
  }
}
