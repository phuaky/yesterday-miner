import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const harnessRoot = resolve(import.meta.dir, "..");
const projectRoot = resolve(harnessRoot, "..");

function resolveFromProject(path: string): string {
  return isAbsolute(path) ? path : resolve(projectRoot, path);
}

export function productSpecPath(): string {
  return resolveFromProject(process.env.PRODUCT_SPEC_PATH ?? "product.md");
}

export function templateSpecPath(): string {
  return resolve(projectRoot, "templates/product.template.md");
}

export function readableProductSpecPath(): string {
  const configured = productSpecPath();
  return existsSync(configured) ? configured : templateSpecPath();
}

export function operatorName(): string {
  return process.env.OPERATOR_NAME?.trim() || "the operator";
}

export function xHandle(): string {
  return process.env.X_HANDLE?.trim() || "your_handle";
}

export function productName(): string {
  return process.env.PRODUCT_NAME?.trim() || "the target product";
}

export function contextName(): string {
  return process.env.CONTEXT_NAME?.trim() || "the selected community or workspace";
}

export function targetAudience(): string {
  return process.env.TARGET_AUDIENCE?.trim() || "the operator's audience";
}

export function candidateFitRubric(): string {
  return process.env.PRODUCT_FIT_RUBRIC?.trim() || `Score 0-10 on fit for the target product.

Higher score when:
- The profile shows the problem, use case, or community the product serves.
- The person has recent activity suggesting urgency or active exploration.
- The person has enough public context to personalize a respectful message.
- Prior engagement with the operator's posts suggests a warm signal.

Lower score when:
- The profile has no relevant signal.
- The person appears unreachable, inactive, spammy, or purely promotional.
- The fit depends on private assumptions not present in the profile.`;
}
