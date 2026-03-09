function parseAuthJson(contents: string): any {
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error("failed to parse ~/.codex/auth.json as JSON");
  }
}

function firstNonEmptyString(candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function parseApiKeyFromAuthJson(contents: string, envApiKey?: string): string {
  if (envApiKey?.trim()) {
    return envApiKey.trim();
  }

  const parsed = parseAuthJson(contents);
  const apiKey = firstNonEmptyString([
    parsed?.OPENAI_API_KEY,
    parsed?.openai_api_key,
    parsed?.api_key,
    parsed?.openai?.api_key,
    parsed?.providers?.openai?.api_key,
  ]);
  if (apiKey) {
    return apiKey;
  }

  throw new Error("failed to read OPENAI API key from ~/.codex/auth.json");
}

export interface ParsedChatgptTokenFromAuth {
  bearerToken: string;
  accountId?: string;
  source: "env" | "tokens.id_token" | "tokens.access_token" | "id_token" | "access_token";
}

export function parseChatgptTokenFromAuthJson(
  contents: string,
  options: {
    envBearerToken?: string;
    envAccountId?: string;
  } = {}
): ParsedChatgptTokenFromAuth {
  if (options.envBearerToken?.trim()) {
    let parsed: any = {};
    if (contents.trim().length > 0) {
      parsed = parseAuthJson(contents);
    }
    const accountId = firstNonEmptyString([
      options.envAccountId,
      parsed?.tokens?.account_id,
      parsed?.account_id,
      parsed?.chatgpt_account_id,
      parsed?.chatgptAccountId,
    ]);
    return {
      bearerToken: options.envBearerToken.trim(),
      accountId,
      source: "env",
    };
  }

  const parsed = parseAuthJson(contents);
  const accountId = firstNonEmptyString([
    options.envAccountId,
    parsed?.tokens?.account_id,
    parsed?.account_id,
    parsed?.chatgpt_account_id,
    parsed?.chatgptAccountId,
  ]);

  const orderedCandidates: Array<{
    value: unknown;
    source: ParsedChatgptTokenFromAuth["source"];
  }> = [
    { value: parsed?.tokens?.access_token, source: "tokens.access_token" },
    { value: parsed?.tokens?.id_token, source: "tokens.id_token" },
    { value: parsed?.access_token, source: "access_token" },
    { value: parsed?.id_token, source: "id_token" },
  ];

  for (const candidate of orderedCandidates) {
    if (typeof candidate.value === "string" && candidate.value.trim().length > 0) {
      return {
        bearerToken: candidate.value.trim(),
        accountId,
        source: candidate.source,
      };
    }
  }

  throw new Error(
    "failed to read ChatGPT token from ~/.codex/auth.json (expected tokens.id_token or tokens.access_token)"
  );
}

function decodeJwtPayload(token?: string): any | null {
  if (typeof token !== "string") {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export interface ParsedChatgptRefreshConfigFromAuth {
  refreshToken?: string;
  clientId?: string;
}

export function parseChatgptRefreshConfigFromAuthJson(contents: string): ParsedChatgptRefreshConfigFromAuth {
  const parsed = parseAuthJson(contents);
  const refreshToken = firstNonEmptyString([parsed?.tokens?.refresh_token, parsed?.refresh_token]);

  let clientId = firstNonEmptyString([
    parsed?.tokens?.client_id,
    parsed?.client_id,
    parsed?.oauth?.client_id,
  ]);

  if (!clientId) {
    const idToken = firstNonEmptyString([parsed?.tokens?.id_token, parsed?.id_token]);
    const payload = decodeJwtPayload(idToken);
    const aud = payload?.aud;
    if (typeof aud === "string" && aud.trim().length > 0) {
      clientId = aud.trim();
    } else if (Array.isArray(aud) && typeof aud[0] === "string" && aud[0].trim().length > 0) {
      clientId = aud[0].trim();
    }
  }

  return { refreshToken, clientId };
}
