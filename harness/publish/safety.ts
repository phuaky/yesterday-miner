/**
 * Pre-publish guardrails: kill switch, dry-run, daily cap, grace period, content filter.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const COUNTER_PATH = `${import.meta.dir}/../cache/post-counter.json`;
type Counter = { date: string; count: number };

export function killSwitchActive(): boolean {
  return process.env.KILL_SWITCH === "1";
}

export function dryRunActive(): boolean {
  return process.env.DRY_RUN === "1";
}

export function dailyCap(): number {
  const parsed = Number(process.env.DAILY_POST_CAP ?? 5);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 5;
}

export function gracePeriodSeconds(): number {
  const parsed = Number(process.env.GRACE_PERIOD_SECONDS ?? 60);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function readCounter(): Counter {
  if (!existsSync(COUNTER_PATH)) return { date: today(), count: 0 };
  try {
    return JSON.parse(readFileSync(COUNTER_PATH, "utf8")) as Counter;
  } catch {
    return { date: today(), count: 0 };
  }
}

function writeCounter(c: Counter): void {
  mkdirSync(dirname(COUNTER_PATH), { recursive: true });
  writeFileSync(COUNTER_PATH, JSON.stringify(c));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns reason string if blocked, null if cleared. */
export function checkPrePublish(): string | null {
  if (killSwitchActive()) return "KILL_SWITCH active";

  let c = readCounter();
  if (c.date !== today()) c = { date: today(), count: 0 };
  const cap = dailyCap();
  if (c.count >= cap) return `daily cap reached (${c.count}/${cap})`;

  return null;
}

/** Call AFTER a successful publish to increment the counter. */
export function recordPublish(): void {
  let c = readCounter();
  if (c.date !== today()) c = { date: today(), count: 0 };
  c.count += 1;
  writeCounter(c);
}

/**
 * Content filter — block obviously unsafe drafts before they reach the grace window.
 * Conservative on purpose. Caller can override per-draft if needed.
 */
export function contentFilter(text: string): { ok: boolean; reason?: string } {
  if (text.length > 280) return { ok: false, reason: "exceeds 280 chars" };
  if (text.length < 10) return { ok: false, reason: "too short (<10 chars)" };
  // crude PII guards — phone, email, credit-card-like
  if (/\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/.test(text)) return { ok: false, reason: "contains phone-like number" };
  if (/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(text)) return { ok: false, reason: "contains email" };
  if (/\b\d{13,19}\b/.test(text)) return { ok: false, reason: "contains card-like number" };
  return { ok: true };
}
