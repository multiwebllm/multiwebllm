import { db } from "./index";
import { providers, models } from "./schema";

const defaultProviders = [
  {
    name: "ChatGPT",
    slug: "chatgpt",
    baseUrl: "https://chatgpt.com",
    authType: "cookie" as const,
  },
  {
    name: "Kimi",
    slug: "kimi",
    baseUrl: "https://kimi.moonshot.cn",
    authType: "cookie" as const,
  },
  {
    name: "Minimax",
    slug: "minimax",
    baseUrl: "https://chat.minimax.io",
    authType: "cookie" as const,
  },
  {
    name: "Grok",
    slug: "grok",
    baseUrl: "https://grok.com",
    authType: "cookie" as const,
  },
  {
    name: "Gemini",
    slug: "gemini",
    baseUrl: "https://gemini.google.com",
    authType: "cookie" as const,
  },
  {
    name: "DeepSeek",
    slug: "deepseek",
    baseUrl: "https://chat.deepseek.com",
    authType: "cookie" as const,
  },
  {
    name: "Claude",
    slug: "claude",
    baseUrl: "https://claude.ai",
    authType: "cookie" as const,
  },
  {
    name: "DouBao",
    slug: "doubao",
    baseUrl: "https://www.doubao.com",
    authType: "cookie" as const,
  },
];

const defaultModels = [
  // ChatGPT (2026)
  { providerSlug: "chatgpt", name: "GPT-4.5", modelId: "gpt-4.5", upstreamModel: "gpt-4.5", maxTokens: 128000, supportsVision: true },
  { providerSlug: "chatgpt", name: "GPT-4o", modelId: "gpt-4o", upstreamModel: "gpt-4o", maxTokens: 128000, supportsVision: true },
  { providerSlug: "chatgpt", name: "GPT-4o Mini", modelId: "gpt-4o-mini", upstreamModel: "gpt-4o-mini", maxTokens: 128000, supportsVision: true },
  { providerSlug: "chatgpt", name: "o3", modelId: "o3", upstreamModel: "o3", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "o3 Mini", modelId: "o3-mini", upstreamModel: "o3-mini", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "o4 Mini", modelId: "o4-mini", upstreamModel: "o4-mini", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "o1", modelId: "o1", upstreamModel: "o1", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "o1 Pro", modelId: "o1-pro", upstreamModel: "o1-pro", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "DALL-E 3", modelId: "dall-e-3", upstreamModel: "dall-e-3", maxTokens: 4096, supportsImageGen: true },

  // Claude (2026)
  { providerSlug: "claude", name: "Claude Opus 4", modelId: "claude-opus-4", upstreamModel: "claude-opus-4-20250514", maxTokens: 200000, supportsVision: true },
  { providerSlug: "claude", name: "Claude Sonnet 4", modelId: "claude-sonnet-4", upstreamModel: "claude-sonnet-4-20250514", maxTokens: 200000, supportsVision: true },
  { providerSlug: "claude", name: "Claude Sonnet 4 (Thinking)", modelId: "claude-sonnet-4-thinking", upstreamModel: "claude-sonnet-4-20250514-thinking", maxTokens: 200000, supportsVision: true },
  { providerSlug: "claude", name: "Claude Haiku 3.5", modelId: "claude-haiku-3.5", upstreamModel: "claude-3-5-haiku-20241022", maxTokens: 200000, supportsVision: true },

  // Gemini (2026)
  { providerSlug: "gemini", name: "Gemini 2.5 Pro", modelId: "gemini-2.5-pro", upstreamModel: "gemini-2.5-pro", maxTokens: 1000000, supportsVision: true },
  { providerSlug: "gemini", name: "Gemini 2.5 Flash", modelId: "gemini-2.5-flash", upstreamModel: "gemini-2.5-flash", maxTokens: 1000000, supportsVision: true },
  { providerSlug: "gemini", name: "Gemini 2.0 Flash", modelId: "gemini-2.0-flash", upstreamModel: "gemini-2.0-flash", maxTokens: 1000000, supportsVision: true },

  // Grok (2026)
  { providerSlug: "grok", name: "Grok 3", modelId: "grok-3", upstreamModel: "grok-3", maxTokens: 131072 },
  { providerSlug: "grok", name: "Grok 3 Mini", modelId: "grok-3-mini", upstreamModel: "grok-3-mini", maxTokens: 131072 },
  { providerSlug: "grok", name: "Grok 3 (Thinking)", modelId: "grok-3-thinking", upstreamModel: "grok-3-thinking", maxTokens: 131072 },

  // DeepSeek (2026)
  { providerSlug: "deepseek", name: "DeepSeek V3-0324", modelId: "deepseek-v3", upstreamModel: "deepseek_chat", maxTokens: 128000 },
  { providerSlug: "deepseek", name: "DeepSeek R1", modelId: "deepseek-r1", upstreamModel: "deepseek_r1", maxTokens: 128000 },

  // Kimi (2026)
  { providerSlug: "kimi", name: "Kimi K2", modelId: "kimi-k2", upstreamModel: "k2", maxTokens: 1000000 },
  { providerSlug: "kimi", name: "Kimi K1.5", modelId: "kimi-k1.5", upstreamModel: "k1.5", maxTokens: 200000 },
  { providerSlug: "kimi", name: "Kimi (长上下文)", modelId: "kimi-long", upstreamModel: "kimi", maxTokens: 2000000 },

  // Minimax (2026)
  { providerSlug: "minimax", name: "MiniMax-01", modelId: "minimax-01", upstreamModel: "minimax-01", maxTokens: 1000000 },
  { providerSlug: "minimax", name: "MiniMax Text", modelId: "minimax-text", upstreamModel: "minimax-text", maxTokens: 245760 },

  // DouBao (2026)
  { providerSlug: "doubao", name: "豆包 Pro 256K", modelId: "doubao-pro", upstreamModel: "doubao-pro-256k", maxTokens: 256000 },
  { providerSlug: "doubao", name: "豆包 1.5 Pro", modelId: "doubao-1.5-pro", upstreamModel: "doubao-1.5-pro", maxTokens: 128000, supportsVision: true },
  { providerSlug: "doubao", name: "豆包 Lite 128K", modelId: "doubao-lite", upstreamModel: "doubao-lite-128k", maxTokens: 128000 },
];

async function seed() {
  console.log("Seeding providers...");

  for (const p of defaultProviders) {
    await db
      .insert(providers)
      .values(p)
      .onConflictDoNothing({ target: providers.slug });
  }

  console.log("Seeding models...");

  // Get provider IDs
  const allProviders = await db.select().from(providers);
  const slugToId = Object.fromEntries(allProviders.map((p) => [p.slug, p.id]));

  for (const m of defaultModels) {
    const providerId = slugToId[m.providerSlug];
    if (!providerId) continue;
    await db
      .insert(models)
      .values({
        providerId,
        name: m.name,
        modelId: m.modelId,
        upstreamModel: m.upstreamModel,
        maxTokens: m.maxTokens,
        supportsVision: (m as Record<string, unknown>).supportsVision as boolean ?? false,
        supportsImageGen: (m as Record<string, unknown>).supportsImageGen as boolean ?? false,
      })
      .onConflictDoNothing({ target: models.modelId });
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
