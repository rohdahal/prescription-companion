import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import open from "open";

type OAuthCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type PiAiAuthResult = {
  apiKey?: string;
  newCredentials?: OAuthCredentials;
};

type PiAiModel = {
  id: string;
  provider: string;
  api: string;
};

type PiAiModule = {
  getModel?: (provider: string, modelId: string) => PiAiModel | undefined;
  complete?: (model: PiAiModel, context: unknown, options?: unknown) => Promise<unknown>;
  loginOpenAICodex?: (input: unknown) => Promise<OAuthCredentials>;
  getOAuthApiKey?: (provider: string, credentialsByProvider: Record<string, OAuthCredentials>) => Promise<PiAiAuthResult>;
};

const oauthPath = path.resolve(process.cwd(), process.env.OPENAI_CODEX_OAUTH_PATH ?? "oauth.json");

function isConfiguredSecret(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return trimmed.toUpperCase() !== "PLACEHOLDER";
}

function serializePayload(credentials: OAuthCredentials) {
  return {
    provider: "openai-codex",
    credentials
  };
}

async function loadOAuthCredentials(): Promise<OAuthCredentials | null> {
  if (!existsSync(oauthPath)) {
    return null;
  }

  const payload = await readFile(oauthPath, "utf8");
  const parsed = JSON.parse(payload) as unknown;

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (record.credentials && typeof record.credentials === "object") {
    return record.credentials as OAuthCredentials;
  }

  // Backward compatibility with previous plain credentials format.
  if (record.accessToken && typeof record.accessToken === "string") {
    return record as unknown as OAuthCredentials;
  }

  return null;
}

async function saveOAuthCredentials(credentials: OAuthCredentials): Promise<void> {
  await writeFile(oauthPath, `${JSON.stringify(serializePayload(credentials), null, 2)}\n`, "utf8");
}

async function runCodexLogin(): Promise<OAuthCredentials> {
  const piAi = (await import("@mariozechner/pi-ai")) as unknown as PiAiModule;
  if (!piAi.loginOpenAICodex) {
    throw new Error("pi_ai_login_unavailable");
  }

  const allowManual = (process.env.CODEX_ALLOW_MANUAL_CODE_INPUT ?? "false").toLowerCase() === "true";
  const rl = readline.createInterface({ input, output });

  try {
    const loginOptions: {
      onAuth: ({ url, instructions }: { url?: string; instructions?: string }) => void;
      onPrompt: ({ message, placeholder }: { message: string; placeholder?: string }) => Promise<string>;
      onProgress: (message: string) => void;
      onManualCodeInput?: () => Promise<string>;
      originator: string;
    } = {
      onAuth: ({ url, instructions }: { url?: string; instructions?: string }) => {
        if (instructions) {
          console.log(instructions);
        }
        if (url) {
          console.log(`\nOpen this URL to login:\n${url}\n`);
          void open(url).catch(() => {
            // Manual fallback if browser launch fails.
          });
        }
      },
      onPrompt: async ({ message, placeholder }: { message: string; placeholder?: string }) => {
        const prompt = `${message}${placeholder ? ` (${placeholder})` : ""}: `;
        return (await rl.question(prompt)).trim();
      },
      onProgress: (message: string) => {
        if (message) {
          console.log(message);
        }
      },
      originator: "pi"
    };

    if (allowManual) {
      loginOptions.onManualCodeInput = async () => {
        const answer = await rl.question("Paste callback URL/code (or press Enter to skip): ");
        return answer.trim();
      };
    }

    const credentials = await piAi.loginOpenAICodex(loginOptions);

    await saveOAuthCredentials(credentials);
    console.log(`Saved OAuth credentials to ${oauthPath}`);

    return credentials;
  } finally {
    rl.close();
  }
}

export async function getOAuthApiKey(): Promise<string> {
  const envApiKey = process.env.OPENAI_CODEX_API_KEY;
  if (isConfiguredSecret(envApiKey)) {
    return envApiKey.trim();
  }

  const piAi = (await import("@mariozechner/pi-ai")) as unknown as PiAiModule;
  if (!piAi.getOAuthApiKey) {
    throw new Error("pi_ai_oauth_unavailable");
  }

  let credentials = await loadOAuthCredentials();
  if (!credentials) {
    credentials = await runCodexLogin();
  }

  const resolved = await piAi.getOAuthApiKey("openai-codex", {
    "openai-codex": credentials
  });

  if (!resolved?.apiKey) {
    throw new Error("unable_to_resolve_codex_oauth_token");
  }

  if (resolved.newCredentials) {
    await saveOAuthCredentials(resolved.newCredentials);
  }

  return resolved.apiKey;
}

export async function getModel(): Promise<PiAiModel> {
  const piAi = (await import("@mariozechner/pi-ai")) as unknown as PiAiModule;
  const configuredModel = process.env.OPENAI_CODEX_MODEL ?? "gpt-5.3-codex";

  if (!piAi.getModel) {
    throw new Error("pi_ai_get_model_unavailable");
  }

  const model = piAi.getModel("openai-codex", configuredModel) ?? piAi.getModel("openai-codex", "gpt-5.3-codex");
  if (!model) {
    throw new Error(`unsupported_openai_codex_model:${configuredModel}`);
  }

  return model;
}

export async function complete(params: { context: unknown; apiKey: string; model: PiAiModel }) {
  const piAi = (await import("@mariozechner/pi-ai")) as unknown as PiAiModule;

  if (piAi.complete) {
    return piAi.complete(params.model, params.context, {
      apiKey: params.apiKey
    });
  }

  return null;
}
