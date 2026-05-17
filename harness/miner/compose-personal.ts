/**
 * Compose a personal-lane post draft from a high-scoring X moment, in the operator's voice.
 * Reads voice/profile.md as the voice anchor.
 */

import { existsSync, readFileSync } from "node:fs";
import { codexExec } from "../lib/codex-exec.ts";
import { operatorName, xHandle } from "../lib/config.ts";
import type { ScoredMoment } from "./score.ts";

const VOICE_PATH = `${import.meta.dir}/../voice/profile.md`;

export async function composePersonal(moment: ScoredMoment, mineDate: string): Promise<string> {
  if (!existsSync(VOICE_PATH)) throw new Error(`No voice profile at ${VOICE_PATH}. Run ingest/voice-profile.ts.`);
  const voice = readFileSync(VOICE_PATH, "utf8");

  const prompt = `You are drafting a post for X in ${operatorName()}'s voice (@${xHandle()}).

VOICE PROFILE:
${voice}

THE MOMENT (from ${mineDate}):
${moment.excerpt}

WHY IT SCORED (${moment.score}/10): ${moment.reason}

Constraints:
- Output ONLY the post text. No commentary. No quotes around it. No "here's a draft:" preamble.
- ≤ 280 chars.
- Sound like the operator from the profile above. If a hook pattern from the profile fits, use it.
- This is a fresh original post — do NOT mention "I tweeted X days ago", do NOT say "looking back".
- Specific > abstract. If the moment had names/numbers/scenes, keep them.
- No hashtags unless the operator uses them in the profile.
- No emoji unless the operator uses them in the profile.

Write the post:`;

  const raw = await codexExec(prompt, { reasoning: "medium", timeoutMs: 60_000 });
  return cleanDraft(raw);
}

function cleanDraft(raw: string): string {
  let t = raw.trim();
  // strip any markdown fences codex sometimes wraps with
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  // strip surrounding quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}
