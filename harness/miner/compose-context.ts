/**
 * Compose an operator-facing post from high-scoring context/community moments.
 */

import { existsSync, readFileSync } from "node:fs";
import { codexExec } from "../lib/codex-exec.ts";
import { contextName, operatorName, productName, targetAudience, xHandle } from "../lib/config.ts";
import type { ScoredMoment } from "./score.ts";

const VOICE_PATH = `${import.meta.dir}/../voice/profile.md`;

export async function composeContext(moments: ScoredMoment[], mineDate: string): Promise<string> {
  if (!existsSync(VOICE_PATH)) throw new Error(`No voice profile at ${VOICE_PATH}. Run ingest/voice-profile.ts.`);
  const voice = readFileSync(VOICE_PATH, "utf8");

  const formatted = moments.slice(0, 5).map((m, i) => `[${i + 1}] (score ${m.score}) ${m.excerpt}`).join("\n\n");

  const prompt = `You are ${operatorName()} (@${xHandle()}), writing a single X post about ${contextName()} in service of ${productName()}.

VOICE PROFILE:
${voice}

CONTEXT MOMENTS from ${mineDate}:
${formatted}

Task: write one post that captures the most interesting thing here for ${targetAudience()}.

Constraints:
- <= 280 chars.
- ONE concrete moment, not a list. Pick the strongest, ignore the rest.
- Anonymize private people by default.
- No private info, no DMs, no health/finance specifics.
- Use the voice profile. Do not write like a press release.
- No "what happened this week" preamble.
- Output ONLY the post text. No commentary.

Write the post:`;

  const raw = await codexExec(prompt, { reasoning: "medium", timeoutMs: 60_000 });
  return raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}
