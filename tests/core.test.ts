import { describe, expect, test } from "bun:test";
import {
  applyDefaultEffort,
  approxTokenCount,
  hasEffortFlag,
  parseOpenAiConfig,
  sanitizeToolFields,
} from "../src/core";

describe("hasEffortFlag", () => {
  test("detects --effort and --effort=", () => {
    expect(hasEffortFlag(["--foo", "--effort"])).toBe(true);
    expect(hasEffortFlag(["--effort=xhigh"])).toBe(true);
    expect(hasEffortFlag(["--model", "x"])).toBe(false);
  });
});

describe("parseOpenAiConfig", () => {
  const openAiMd = `
    [model_providers.unlimitex]
    base_url = "https://example.com/v1"

    {
      "OPENAI_API_KEY": "from-file-key"
    }
  `;

  test("parses base_url and API key", () => {
    const parsed = parseOpenAiConfig(openAiMd);
    expect(parsed.upstreamBaseUrl).toBe("https://example.com/v1");
    expect(parsed.upstreamApiKey).toBe("from-file-key");
  });

  test("prefers environment API key", () => {
    const parsed = parseOpenAiConfig(openAiMd, "env-key");
    expect(parsed.upstreamApiKey).toBe("env-key");
  });

  test("throws when required values are missing", () => {
    expect(() => parseOpenAiConfig("")).toThrow("failed to read base_url");
  });
});

describe("approxTokenCount", () => {
  test("counts text parts", () => {
    const count = approxTokenCount({
      messages: [
        { content: "abcd" },
        { content: [{ text: "1234" }, { content: "abcd" }] },
      ],
    });
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("returns at least one", () => {
    expect(approxTokenCount({})).toBe(1);
  });
});

describe("applyDefaultEffort", () => {
  test("sets xhigh for gpt-5.3-codex by default", () => {
    const body: Record<string, any> = {};
    applyDefaultEffort(body, {
      forcedModel: "gpt-5.3-codex",
      defaultReasoningEffort: "xhigh",
      preserveClientEffort: false,
    });
    expect(body.output_config.effort).toBe("xhigh");
    expect(body.reasoning.effort).toBe("xhigh");
  });

  test("does not overwrite when preserving client effort", () => {
    const body: Record<string, any> = {};
    applyDefaultEffort(body, {
      forcedModel: "gpt-5.3-codex",
      defaultReasoningEffort: "xhigh",
      preserveClientEffort: true,
    });
    expect(body.output_config).toBeUndefined();
  });
});

describe("sanitizeToolFields", () => {
  test("removes defer_loading from each tool", () => {
    const body: Record<string, any> = {
      tools: [{ name: "a", defer_loading: true }, { name: "b" }],
    };
    const removed = sanitizeToolFields(body);
    expect(removed).toBe(1);
    expect(body.tools[0].defer_loading).toBeUndefined();
  });
});
