export type JsonObject = Record<string, any>;

export function hasEffortFlag(args: string[]): boolean {
  return args.some((arg) => arg === "--effort" || arg.startsWith("--effort="));
}

export function parseOpenAiConfig(
  contents: string,
  envApiKey?: string
): { upstreamBaseUrl: string; upstreamApiKey: string } {
  const upstreamBaseUrl = contents.match(/^\s*base_url\s*=\s*"([^"]+)"/m)?.[1]?.trim();
  const keyInFile = contents.match(/"OPENAI_API_KEY"\s*:\s*"([^"]+)"/m)?.[1]?.trim();
  const upstreamApiKey = envApiKey?.trim() || keyInFile;

  if (!upstreamBaseUrl) {
    throw new Error("failed to read base_url from OPENAI.md");
  }
  if (!upstreamApiKey) {
    throw new Error("failed to read OPENAI_API_KEY from OPENAI.md");
  }

  return { upstreamBaseUrl, upstreamApiKey };
}

export function approxTokenCount(body: JsonObject): number {
  const lines: string[] = [];
  if (Array.isArray(body?.messages)) {
    for (const message of body.messages) {
      if (typeof message?.content === "string") {
        lines.push(message.content);
        continue;
      }
      if (Array.isArray(message?.content)) {
        for (const part of message.content) {
          if (typeof part?.text === "string") {
            lines.push(part.text);
          }
          if (typeof part?.content === "string") {
            lines.push(part.content);
          }
        }
      }
    }
  }

  const text = lines.join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

export function hasExplicitEffort(body: JsonObject): boolean {
  return Boolean(
    (typeof body?.effort === "string" && body.effort.length > 0) ||
      (typeof body?.output_config?.effort === "string" && body.output_config.effort.length > 0) ||
      (typeof body?.reasoning?.effort === "string" && body.reasoning.effort.length > 0)
  );
}

export function applyDefaultEffort(
  body: JsonObject,
  options: {
    forcedModel: string;
    defaultReasoningEffort: string;
    preserveClientEffort: boolean;
  }
): void {
  if (options.forcedModel !== "gpt-5.3-codex") {
    return;
  }
  if (options.preserveClientEffort || hasExplicitEffort(body)) {
    return;
  }

  if (typeof body.output_config !== "object" || body.output_config === null) {
    body.output_config = {};
  }
  body.output_config.effort = options.defaultReasoningEffort;

  if (typeof body.reasoning !== "object" || body.reasoning === null) {
    body.reasoning = {};
  }
  body.reasoning.effort = options.defaultReasoningEffort;
}

export function sanitizeToolFields(body: JsonObject): number {
  let removed = 0;
  if (!Array.isArray(body?.tools)) {
    return removed;
  }

  for (const tool of body.tools) {
    if (!tool || typeof tool !== "object") {
      continue;
    }
    if ("defer_loading" in tool) {
      delete tool.defer_loading;
      removed += 1;
    }
  }

  return removed;
}
