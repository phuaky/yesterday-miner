#!/usr/bin/env bun
/**
 * Ralph harness entry point.
 *
 * Commands:
 *   bun ralph.ts mine        - run miner Ralph loop (X + Discord lanes)
 *   bun ralph.ts scout       - extract candidates, score fit, queue DM drafts
 *   bun ralph.ts ingest      - run all ingestion (X + Discord, no voice rebuild)
 *   bun ralph.ts voice       - rebuild voice profile from X cache
 *   bun ralph.ts all         - ingest → mine → scout (the full lobster-costume run)
 *
 * Env: see .env.example. Critical safety:
 *   DRY_RUN=1    drafts to Telegram, no X posts
 *   KILL_SWITCH=1   exit immediately on startup
 *
 * Product source of truth: PRODUCT_SPEC_PATH or ../product.md
 */

import { existsSync } from "node:fs";
import { killSwitchActive } from "./publish/safety.ts";
import { walk } from "./miner/day-walker.ts";
import { extractCandidates } from "./scout/candidates.ts";
import { enrichCandidates, scoreFit } from "./scout/fit-score.ts";
import { queueScoutDraft } from "./scout/dm-compose.ts";
import { sendInfo } from "./telegram/send.ts";
import { appendLog } from "./parser/spec.ts";
import { productSpecPath } from "./lib/config.ts";

const SPEC_PATH = productSpecPath();

function appendSpecLog(entry: string): void {
  if (!existsSync(SPEC_PATH)) {
    console.warn(`Product spec not found at ${SPEC_PATH}; skipping spec log.`);
    return;
  }
  appendLog(SPEC_PATH, entry);
}

function lookbackDays(): number {
  return Number(process.env.LOOKBACK_DAYS ?? 30);
}

async function cmdIngest(): Promise<void> {
  const days = lookbackDays();
  console.log(`Ingesting X (last ${days}d)…`);
  const xProc = Bun.spawn(["bun", `${import.meta.dir}/ingest/x-fetch.ts`, "--days", String(days)], {
    stdout: "inherit", stderr: "inherit",
  });
  await xProc.exited;

  if (process.env.DISCORD_CHANNELS) {
    console.log(`Ingesting Discord (last ${days}d)…`);
    const dProc = Bun.spawn(["bun", `${import.meta.dir}/ingest/discord-fetch.ts`, "--days", String(days)], {
      stdout: "inherit", stderr: "inherit",
    });
    await dProc.exited;
  } else {
    console.log("DISCORD_CHANNELS empty — skipping Discord ingest.");
  }
}

async function cmdVoice(): Promise<void> {
  const proc = Bun.spawn(["bun", `${import.meta.dir}/ingest/voice-profile.ts`], {
    stdout: "inherit", stderr: "inherit",
  });
  await proc.exited;
}

async function cmdMine(): Promise<void> {
  const days = lookbackDays();
  const lanes: Array<"personal" | "context"> = process.env.DISCORD_CHANNELS
    ? ["personal", "context"]
    : ["personal"];
  await sendInfo(`🚀 Ralph mining ${days}d, lanes: ${lanes.join("+")} ${process.env.DRY_RUN === "1" ? "[DRY]" : ""}`);
  appendSpecLog(`[ralph-start] mine ${days}d lanes=${lanes.join("+")} dry=${process.env.DRY_RUN === "1"}`);
  await walk({ days, lanes });
  await sendInfo(`✅ Ralph mining complete (${days}d).`);
  appendSpecLog(`[ralph-done] mine ${days}d complete`);
}

async function cmdScout(): Promise<void> {
  const days = lookbackDays();
  console.log(`Extracting candidates from last ${days}d X cache…`);
  const raw = extractCandidates(days);
  if (raw.length === 0) {
    await sendInfo(`🎯 Scout: no engaged candidates in last ${days}d. Run ingest first?`);
    return;
  }
  const topUsernames = raw.slice(0, 50).map((c) => c.username);
  console.log(`Enriching ${topUsernames.length} via Apify…`);
  const enriched = await enrichCandidates(topUsernames);
  // merge contexts back
  const byName = new Map(raw.map((c) => [c.username, c]));
  for (const e of enriched) {
    const orig = byName.get(e.username);
    if (orig) {
      e.firstSeen = orig.firstSeen;
      e.contexts = orig.contexts;
      e.signalCount = orig.signalCount;
    }
  }
  console.log(`Fit-scoring…`);
  const scored = await scoreFit(enriched);
  const top = scored.filter((c) => c.fitScore >= 7).slice(0, 10);
  await sendInfo(`🎯 Scout: ${top.length} high-fit candidates queued (≥7/10).`);
  for (const c of top) {
    await queueScoutDraft(c);
  }
  appendSpecLog(`[scout-done] queued ${top.length} cold DM drafts`);
}

async function main(): Promise<void> {
  if (killSwitchActive()) {
    console.error("KILL_SWITCH=1 — refusing to run.");
    process.exit(1);
  }

  const cmd = process.argv[2] ?? "mine";
  switch (cmd) {
    case "ingest": await cmdIngest(); break;
    case "voice":  await cmdVoice();  break;
    case "mine":   await cmdMine();   break;
    case "scout":  await cmdScout();  break;
    case "all":
      await cmdIngest();
      await cmdVoice();
      await cmdMine();
      await cmdScout();
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      console.error("usage: bun ralph.ts {ingest|voice|mine|scout|all}");
      process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
