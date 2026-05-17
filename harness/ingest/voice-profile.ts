/**
 * One-time: build voice/profile.md from cached operator posts.
 * Run AFTER x-fetch.ts has populated cache/x/.
 *
 * Profile = Codex-distilled characterization of the operator's voice:
 * tone, length norms, hook patterns, recurring themes, vocabulary, taboos.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { codexExec } from "../lib/codex-exec.ts";
import { operatorName, targetAudience, xHandle } from "../lib/config.ts";
import type { RawTweet } from "./x-fetch.ts";

const CACHE_DIR = `${import.meta.dir}/../cache/x`;
const OUT_DIR = `${import.meta.dir}/../voice`;

function loadAllOriginals(): RawTweet[] {
  if (!existsSync(CACHE_DIR)) throw new Error(`No cache at ${CACHE_DIR}. Run ingest/x-fetch.ts first.`);
  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  const out: RawTweet[] = [];
  for (const f of files) {
    const day = JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8")) as RawTweet[];
    for (const t of day) {
      if (!t.isRetweet && !t.isReply) out.push(t); // only original posts shape voice
    }
  }
  return out.sort((a, b) => (b.likeCount + b.retweetCount) - (a.likeCount + a.retweetCount));
}

async function buildProfile(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const originals = loadAllOriginals();
  if (originals.length === 0) {
    console.error("No original posts in cache. Voice profile cannot be built.");
    process.exit(1);
  }

  const corpusPath = `${OUT_DIR}/corpus.jsonl`;
  writeFileSync(corpusPath, originals.map((t) => JSON.stringify({ text: t.text, likes: t.likeCount, rts: t.retweetCount })).join("\n"));
  console.log(`Wrote corpus: ${originals.length} originals → ${corpusPath}`);

  const sample = originals.slice(0, 100).map((t, i) => `${i + 1}. [${t.likeCount}♥ ${t.retweetCount}🔁] ${t.text}`).join("\n\n");

  const prompt = `You are profiling a writer's voice from their X (Twitter) posts.

Analyze the ${Math.min(100, originals.length)} highest-engagement original posts below from ${operatorName()} (@${xHandle()}), whose intended audience is ${targetAudience()}.

Produce a tight voice profile in markdown with these sections:

## Tone
2-3 adjectives + 1 line on emotional register.

## Length norms
Median chars, common lengths, when he goes long vs short.

## Hook patterns
3-5 opening moves he uses (with 1-2 examples each, quoted).

## Recurring themes
Top 5 topics he comes back to.

## Vocabulary signatures
Words/phrases/punctuation that are distinctly him.

## Format quirks
Line breaks, capitalization, emoji use, em-dashes, etc.

## Taboos (what he does NOT do)
Things that would feel off-brand if a draft included them.

## Voice rubric (for grading drafts)
5 yes/no questions a grader would ask to check "does this sound like the operator?"

POSTS:
${sample}`;

  console.log("Calling Codex to distill voice profile…");
  const profile = await codexExec(prompt, { reasoning: "high", timeoutMs: 5 * 60_000 });
  const profilePath = `${OUT_DIR}/profile.md`;
  writeFileSync(profilePath, profile);
  console.log(`Wrote profile → ${profilePath}`);
}

if (import.meta.main) {
  await buildProfile();
}
