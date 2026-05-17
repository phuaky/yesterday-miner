export type HandoffItem = {
  path: string;
  input: string;
  requiredFormat: string;
  notes?: string;
};

type HandoffPaths = {
  envPath: string;
  inputPath: string;
  productSpecPath: string;
};

function envFormat(name: string): string {
  switch (name) {
    case "TELEGRAM_BOT_TOKEN":
      return "TELEGRAM_BOT_TOKEN=<Telegram bot token from BotFather>";
    case "TELEGRAM_CHAT_ID":
      return "TELEGRAM_CHAT_ID=<integer Telegram chat id, group id, or channel id>";
    case "PRODUCT_NAME":
      return "PRODUCT_NAME=<plain product name, one line>";
    case "OPERATOR_NAME":
      return "OPERATOR_NAME=<operator display name, one line>";
    case "TARGET_AUDIENCE":
      return "TARGET_AUDIENCE=<one-line audience description>";
    default:
      return `${name}=<real value>`;
  }
}

function inputFormat(field: string): string {
  switch (field) {
    case "mineDate":
      return "\"YYYY-MM-DD\", matching yesterday for the operator dry run";
    case "postSignal.text":
      return "\"one real yesterday signal from X, notes, or cache\"";
    case "postSignal.reason":
      return "\"why this signal is worth drafting into a post\"";
    case "scoutCandidate.username":
      return "\"x_username_without_at\"";
    case "scoutCandidate.fitReason":
      return "\"why this person is a fit for the product\"";
    case "scoutCandidate.bio":
      return "\"public bio or public context, no placeholder text\"";
    case "scoutCandidate.contexts":
      return "[\"public context URL or note\", \"...\"]";
    default:
      return "JSON value matching docs/demo-input.example.json";
  }
}

export function handoffForIssue(issue: string, paths: HandoffPaths): HandoffItem | null {
  const missingEnv = issue.match(/^harness\/\.env missing (?:real|or invalid) ([A-Z0-9_]+)$/);
  if (missingEnv) {
    const name = missingEnv[1]!;
    return {
      path: paths.envPath,
      input: name,
      requiredFormat: envFormat(name),
    };
  }

  const requiredEnv = issue.match(/^harness\/\.env (?:must set|missing or invalid) ([A-Z0-9_]+=[^ ]+)$/);
  if (requiredEnv) {
    const assignment = requiredEnv[1]!;
    return {
      path: paths.envPath,
      input: assignment.split("=")[0]!,
      requiredFormat: assignment,
    };
  }

  const productHandoff = issue.match(/^product\.md §5 What I need from you unresolved: (.+)$/);
  if (productHandoff) {
    return {
      path: paths.productSpecPath,
      input: `§5 What I need from you -> ${productHandoff[1]!}`,
      requiredFormat: "Markdown handoff item resolved with real private product/operator/source detail; keep the 8-section order intact.",
    };
  }

  if (issue.startsWith("product spec missing at ")) {
    return {
      path: paths.productSpecPath,
      input: "product spec",
      requiredFormat: "Markdown file copied from /Users/pky/No-AI/templates/product.template.md with the 8-section loop intact.",
    };
  }

  if (issue.includes("must parse as the 8-section markdown loop")) {
    return {
      path: paths.productSpecPath,
      input: "product spec",
      requiredFormat: "Markdown with sections 1-8 in this exact order: Goal, Done, Observe, Think, Plan, Execute, Verify, Reflect-if-passed.",
    };
  }

  if (issue === `Create ${paths.inputPath}`) {
    return {
      path: paths.inputPath,
      input: "demo input",
      requiredFormat: "JSON object matching /Users/pky/No-AI/harness/docs/demo-input.example.json.",
    };
  }

  if (issue.includes("must be valid JSON matching")) {
    return {
      path: paths.inputPath,
      input: "demo input",
      requiredFormat: "Valid JSON object matching /Users/pky/No-AI/harness/docs/demo-input.example.json.",
    };
  }

  const missingInput = issue.match(/^(?:demo input|demo\/demo-input\.json) (?:missing|needs real) (.+)$/);
  if (missingInput) {
    const field = missingInput[1]!;
    return {
      path: paths.inputPath,
      input: field,
      requiredFormat: inputFormat(field),
    };
  }

  const mineDateFormat = issue.match(/^(?:demo input|demo\/demo-input\.json) mineDate must be .+$/);
  if (mineDateFormat) {
    return {
      path: paths.inputPath,
      input: "mineDate",
      requiredFormat: inputFormat("mineDate"),
    };
  }

  const placeholderInput = issue.match(/^(?:demo input|demo\/demo-input\.json) (scoutCandidate\.(?:bio|contexts)) .+$/);
  if (placeholderInput) {
    const field = placeholderInput[1]!;
    return {
      path: paths.inputPath,
      input: field,
      requiredFormat: inputFormat(field),
    };
  }

  return null;
}

export function handoffFromIssues(issues: string[], paths: HandoffPaths): HandoffItem[] {
  return issues
    .map((issue) => handoffForIssue(issue, paths))
    .filter((item): item is HandoffItem => Boolean(item))
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.path === item.path &&
        candidate.input === item.input &&
        candidate.requiredFormat === item.requiredFormat
      ) === index
    );
}

export function handoffLines(handoff: HandoffItem[]): string[] {
  return handoff.map((item) => `${item.path} -> ${item.input}: ${item.requiredFormat}`);
}
