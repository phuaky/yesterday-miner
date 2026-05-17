/**
 * Parser for No-AI spec files (the 8-section template).
 * Read-only for §1–§4, write-aware for §5 checkboxes, §6 log, §7 verification.
 */

import { readFileSync, writeFileSync } from "node:fs";

export type Section = {
  number: number;
  title: string;
  body: string;
  start: number; // line index in raw file
  end: number;
};

export type Spec = {
  path: string;
  raw: string;
  sections: Map<number, Section>;
};

const SECTION_RE = /^## (\d)\. (.+)$/;

export function readSpec(path: string): Spec {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n");
  const sections = new Map<number, Section>();
  let current: Section | null = null;

  lines.forEach((line, i) => {
    const m = line.match(SECTION_RE);
    if (m) {
      if (current) {
        current.end = i - 1;
        current.body = lines.slice(current.start + 1, current.end + 1).join("\n");
        sections.set(current.number, current);
      }
      current = {
        number: Number(m[1]),
        title: m[2]!,
        body: "",
        start: i,
        end: lines.length - 1,
      };
    }
  });
  if (current !== null) {
    const c = current as Section;
    c.body = lines.slice(c.start + 1, c.end + 1).join("\n");
    sections.set(c.number, c);
  }

  return { path, raw, sections };
}

/** Parse "What I need from you" items from §5. Returns unfulfilled (unchecked) entries. */
export function unfulfilledHumanInputs(spec: Spec): string[] {
  const s5 = spec.sections.get(5);
  if (!s5) return [];
  const lines = s5.body.split("\n");
  const out: string[] = [];
  let in_section = false;
  for (const line of lines) {
    if (/what i need from you/i.test(line)) {
      in_section = true;
      continue;
    }
    if (in_section && /^\*\*[A-Z]/.test(line.trim())) break; // next bold heading ends block
    if (!in_section) continue;
    // skip strikethrough resolved items
    if (line.includes("~~")) continue;
    if (line.includes("✅")) continue;
    const m = line.match(/^- \*\*(.+?)\*\*/);
    if (m) out.push(m[1]!);
  }
  return out;
}

/** Parse §5 "My next steps" → unchecked task strings. */
export function pendingTasks(spec: Spec): string[] {
  const s5 = spec.sections.get(5);
  if (!s5) return [];
  const lines = s5.body.split("\n");
  const out: string[] = [];
  let in_section = false;
  for (const line of lines) {
    if (/my next steps/i.test(line)) {
      in_section = true;
      continue;
    }
    if (in_section && /^###|^\*\*[A-Z]/.test(line.trim())) break;
    if (!in_section) continue;
    const m = line.match(/^- \[ \] (.+)$/);
    if (m) out.push(m[1]!);
  }
  return out;
}

/** Parse §2 criteria as { text, checked } */
export function criteria(spec: Spec): { text: string; checked: boolean }[] {
  const s2 = spec.sections.get(2);
  if (!s2) return [];
  const out: { text: string; checked: boolean }[] = [];
  for (const line of s2.body.split("\n")) {
    const m = line.match(/^- \[( |x)\] (.+)$/);
    if (m) out.push({ text: m[2]!, checked: m[1] === "x" });
  }
  return out;
}

/** Prepend a dated entry to §6 Execute log (newest-first per template rule). */
export function appendLog(path: string, entry: string): void {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => /^## 6\. /.test(l));
  if (idx < 0) throw new Error("No §6 in spec");

  // find first non-comment, non-heading content line after §6 header
  let insertAt = idx + 1;
  while (
    insertAt < lines.length &&
    (lines[insertAt]!.trim() === "" ||
      lines[insertAt]!.startsWith("<") ||
      lines[insertAt]!.includes("Newest entries"))
  ) {
    insertAt++;
  }

  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toTimeString().slice(0, 5);
  const block = `- **${today} ${time}:** ${entry}`;
  lines.splice(insertAt, 0, block);
  writeFileSync(path, lines.join("\n"));
}

/** Mark a §7 criterion checkbox checked by exact text match. */
export function markCriterion(path: string, criterionText: string): void {
  const raw = readFileSync(path, "utf8");
  // §7 references criteria by text; we just flip its checkbox in §2 (source of truth)
  // and also any explicit copy in §7.
  const updated = raw.replace(
    new RegExp(`^- \\[ \\] (${escapeRegex(criterionText)})$`, "m"),
    "- [x] $1",
  );
  if (updated === raw) {
    console.warn(`[parser] criterion not found or already checked: ${criterionText}`);
  }
  writeFileSync(path, updated);
}

/** Mark a §5 "My next steps" task as completed. */
export function markTask(path: string, taskText: string): void {
  const raw = readFileSync(path, "utf8");
  const updated = raw.replace(
    new RegExp(`^- \\[ \\] (${escapeRegex(taskText)})$`, "m"),
    "- [x] $1",
  );
  writeFileSync(path, updated);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// CLI smoke test: bun parser/spec.ts ../templates/product.template.md
if (import.meta.main) {
  const path = process.argv[2] ?? "../templates/product.template.md";
  const spec = readSpec(path);
  console.log(`Sections found: ${[...spec.sections.keys()].join(", ")}`);
  console.log(`\nCriteria (§2):`);
  for (const c of criteria(spec)) console.log(`  [${c.checked ? "x" : " "}] ${c.text}`);
  console.log(`\nUnfulfilled human inputs (§5):`);
  for (const h of unfulfilledHumanInputs(spec)) console.log(`  - ${h}`);
  console.log(`\nPending tasks (§5):`);
  for (const t of pendingTasks(spec)) console.log(`  - ${t}`);
}
