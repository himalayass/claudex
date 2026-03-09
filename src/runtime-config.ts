import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  parseApiKeyFromAuthJson,
  parseChatgptRefreshConfigFromAuthJson,
  parseChatgptTokenFromAuthJson,
} from "./auth-json.ts";
import { normalizeWireApi, parseCodexConfig, resolveUpstreamFromCodexConfig } from "./config.ts";

export interface RuntimeConfig {
  upstreamBaseUrl: string;
  upstreamBearerToken: string;
  upstreamExtraHeaders: Record<string, string>;
  upstreamWireApi: "messages" | "responses";
  forcedModel: string;
  authMode: "provider-api-key" | "chatgpt-token" | "chatgpt-api-key";
  chatgptRefreshConfig?: {
    authPath: string;
    refreshToken: string;
    clientId: string;
  };
}

export function trimOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function resolveCodexPaths(): { configPath: string; authPath: string } {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
  const configPath = process.env.CLAUDEX_CODEX_CONFIG?.trim() || join(codexHome, "config.toml");
  const authPath = process.env.CLAUDEX_CODEX_AUTH?.trim() || join(codexHome, "auth.json");
  return { configPath, authPath };
}

export function loadRuntimeConfig(): RuntimeConfig {
  const { configPath, authPath } = resolveCodexPaths();

  const providerOverride = trimOrNull(process.env.CLAUDEX_MODEL_PROVIDER) || undefined;
  const baseUrlOverride = trimOrNull(process.env.CLAUDEX_UPSTREAM_BASE_URL) || undefined;
  const wireApiOverride = normalizeWireApi(process.env.CLAUDEX_UPSTREAM_WIRE_API);
  const chatgptBaseUrl =
    trimOrNull(process.env.CLAUDEX_CHATGPT_BASE_URL) || "https://chatgpt.com/backend-api/codex";
  const envApiKey = trimOrNull(process.env.CLAUDEX_UPSTREAM_API_KEY) || trimOrNull(process.env.OPENAI_API_KEY) || undefined;
  const envBearerToken =
    trimOrNull(process.env.CLAUDEX_UPSTREAM_BEARER_TOKEN) ||
    trimOrNull(process.env.CLAUDEX_CHATGPT_BEARER_TOKEN) ||
    undefined;
  const envChatgptAccountId = trimOrNull(process.env.CLAUDEX_CHATGPT_ACCOUNT_ID) || undefined;

  let configContents = "";
  let modelFromConfig: string | undefined;
  let resolvedProvider: ReturnType<typeof resolveUpstreamFromCodexConfig> | null = null;
  if (existsSync(configPath)) {
    configContents = readFileSync(configPath, "utf8");
    modelFromConfig = parseCodexConfig(configContents).model;
    try {
      resolvedProvider = resolveUpstreamFromCodexConfig(configContents, {
        providerOverride,
        baseUrlOverride,
        wireApiOverride,
      });
    } catch {
      resolvedProvider = null;
    }
  } else if (baseUrlOverride) {
    resolvedProvider = {
      baseUrl: baseUrlOverride,
      providerKey: providerOverride,
      model: undefined,
      wireApi: wireApiOverride,
    };
  }

  const forceModelFromEnv = trimOrNull(process.env.CLAUDEX_FORCE_MODEL) || undefined;
  const forceModelFromConfig = trimOrNull(modelFromConfig) || undefined;
  let forcedModelSource: "env" | "config" | "default" = "default";
  if (forceModelFromEnv) {
    forcedModelSource = "env";
  } else if (forceModelFromConfig) {
    forcedModelSource = "config";
  }

  const defaultForcedModel = "gpt-5.3-codex";
  const forcedModel = (forceModelFromEnv || forceModelFromConfig || defaultForcedModel).trim();

  const authFileExists = existsSync(authPath);
  const authContents = authFileExists ? readFileSync(authPath, "utf8") : "";
  const authUnavailable = !authFileExists && !envApiKey && !envBearerToken;
  if (authUnavailable) {
    throw new Error(`missing auth file: ${authPath}`);
  }

  if (resolvedProvider?.baseUrl?.trim()) {
    return {
      upstreamBaseUrl: resolvedProvider.baseUrl,
      upstreamBearerToken: parseApiKeyFromAuthJson(authContents, envApiKey),
      upstreamExtraHeaders: {},
      upstreamWireApi: resolvedProvider.wireApi || "messages",
      forcedModel,
      authMode: "provider-api-key",
    };
  }

  try {
    const tokenAuth = parseChatgptTokenFromAuthJson(authContents, {
      envBearerToken,
      envAccountId: envChatgptAccountId,
    });
    const refreshConfig = authContents.trim().length > 0 ? parseChatgptRefreshConfigFromAuthJson(authContents) : {};

    const extraHeaders: Record<string, string> = {};
    if (tokenAuth.accountId) {
      extraHeaders["chatgpt-account-id"] = tokenAuth.accountId;
    }

    const canAutoRefresh =
      !envBearerToken &&
      typeof refreshConfig.refreshToken === "string" &&
      refreshConfig.refreshToken.length > 0 &&
      typeof refreshConfig.clientId === "string" &&
      refreshConfig.clientId.length > 0;

    let chatgptForcedModel = forcedModel;
    if (forcedModelSource === "default" && forcedModel === defaultForcedModel) {
      chatgptForcedModel = (process.env.CLAUDEX_CHATGPT_DEFAULT_MODEL || "gpt-5-codex").trim();
    }

    return {
      upstreamBaseUrl: chatgptBaseUrl,
      upstreamBearerToken: tokenAuth.bearerToken,
      upstreamExtraHeaders: extraHeaders,
      upstreamWireApi: "responses",
      forcedModel: chatgptForcedModel,
      authMode: "chatgpt-token",
      chatgptRefreshConfig: canAutoRefresh
        ? {
            authPath,
            refreshToken: refreshConfig.refreshToken!,
            clientId: refreshConfig.clientId!,
          }
        : undefined,
    };
  } catch {
    let chatgptForcedModel = forcedModel;
    if (forcedModelSource === "default" && forcedModel === defaultForcedModel) {
      chatgptForcedModel = (process.env.CLAUDEX_CHATGPT_DEFAULT_MODEL || "gpt-5-codex").trim();
    }

    return {
      upstreamBaseUrl: chatgptBaseUrl,
      upstreamBearerToken: parseApiKeyFromAuthJson(authContents, envApiKey),
      upstreamExtraHeaders: {},
      upstreamWireApi: "responses",
      forcedModel: chatgptForcedModel,
      authMode: "chatgpt-api-key",
    };
  }
}
