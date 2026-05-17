/**
 * Compose a cold DM for a high-fit candidate. Output to Telegram for approval.
 * v1: DM sending stays MANUAL — harness drafts, the operator sends from their account.
 * (Auto-DM via X API is heavily restricted & ToS-risky on cold contacts.)
 */

import { existsSync, readFileSync } from "node:fs";
import { codexExec } from "../lib/codex-exec.ts";
import { operatorName, productName, readableProductSpecPath, xHandle } from "../lib/config.ts";
import { registerDraft } from "../telegram/bot.ts";
import { sendDraft, draftId, type Draft } from "../telegram/send.ts";
import type { ScoredCandidate } from "./fit-score.ts";

const VOICE_PATH = `${import.meta.dir}/../voice/profile.md`;

export async function composeDm(c: ScoredCandidate): Promise<string> {
  const voice = existsSync(VOICE_PATH) ? readFileSync(VOICE_PATH, "utf8") : "";
  const productSpec = readFileSync(readableProductSpecPath(), "utf8");

  const prompt = `You are drafting a cold DM from ${operatorName()} (@${xHandle()}) to a high-fit prospect for ${productName()}.

VOICE PROFILE:
${voice}

PRODUCT SPEC (for context only — do NOT paste verbatim):
${productSpec.slice(0, 6000)}

PROSPECT:
@${c.username} | followers: ${c.followers} | bio: ${c.bio}
Fit reason: ${c.fitReason}
Engagement context: ${c.contexts.length} prior interactions with the operator's posts

Constraints:
- <= 350 chars.
- Sound like the operator — conversational, not salesy, not corporate.
- Reference ONE specific thing from their bio or engagement (not generic).
- Mention the product once, briefly. Soft CTA — ask if they're curious, don't pitch.
- Do NOT promise outcomes or incentives not explicit in the product spec.
- No emoji unless the operator uses them in the profile.
- Output ONLY the DM text. No "here's a draft:" preamble.

Write the DM:`;

  const raw = await codexExec(prompt, { reasoning: "medium", timeoutMs: 60_000 });
  return raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

export async function queueScoutDraft(c: ScoredCandidate): Promise<void> {
  const body = await composeDm(c);
  const date = new Date().toISOString().slice(0, 10);
  const id = draftId({ lane: "scout-lead", date: `@${c.username}`, body });
  const draft: Draft = {
    id,
    lane: "scout-lead",
    date: `@${c.username}`,
    body: `@${c.username} (fit ${c.fitScore}/10) - ${c.fitReason}\n\n---\n\n${body}`,
    meta: { username: c.username, fitScore: c.fitScore },
  };
  registerDraft(draft);
  await sendDraft(draft);
}
