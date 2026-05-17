/**
 * Wrapper around `codex exec` — shared executor for all skills.
 * Returns stdout as string. Caller responsible for parsing.
 */

import { spawn } from "node:child_process";

export type CodexOptions = {
  model?: string;
  reasoning?: "low" | "medium" | "high";
  cwd?: string;
  timeoutMs?: number;
  jsonOutput?: boolean;
};

export async function codexExec(prompt: string, opts: CodexOptions = {}): Promise<string> {
  const model = opts.model ?? process.env.CODEX_MODEL ?? "gpt-5-codex";
  const reasoning = opts.reasoning ?? "medium";
  const cwd = opts.cwd ?? process.cwd();
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;

  const args = ["exec", "--model", model, "-c", `model_reasoning_effort=${reasoning}`];
  if (opts.jsonOutput) args.push("--json");
  args.push(prompt);

  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`codex exec exit ${code}: ${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
