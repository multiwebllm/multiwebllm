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
  // ChatGPT
  { providerSlug: "chatgpt", name: "GPT-4o", modelId: "gpt-4o", upstreamModel: "gpt-4o", maxTokens: 128000 },
  { providerSlug: "chatgpt", name: "GPT-4o Mini", modelId: "gpt-4o-mini", upstreamModel: "gpt-4o-mini", maxTokens: 128000 },
  { providerSlug: "chatgpt", name: "o1", modelId: "o1", upstreamModel: "o1", maxTokens: 200000 },
  { providerSlug: "chatgpt", name: "o1-pro", modelId: "o1-pro", upstreamModel: "o1-pro", maxTokens: 200000 },
  // Kimi
  { providerSlug: "kimi", name: "Kimi K2", modelId: "kimi-k2", upstreamModel: "k2", maxTokens: 200000 },
  { providerSlug: "kimi", name: "Kimi", modelId: "kimi", upstreamModel: "kimi", maxTokens: 200000 },
  // Minimax
  { providerSlug: "minimax", name: "Minimax", modelId: "minimax", upstreamModel: "minimax", maxTokens: 100000 },
  // Grok
  { providerSlug: "grok", name: "Grok 3", modelId: "grok-3", upstreamModel: "grok-3", maxTokens: 131072 },
  { providerSlug: "grok", name: "Grok 3 Mini", modelId: "grok-3-mini", upstreamModel: "grok-3-mini", maxTokens: 131072 },
  // Gemini
  { providerSlug: "gemini", name: "Gemini 2.5 Pro", modelId: "gemini-2.5-pro", upstreamModel: "gemini-2.5-pro", maxTokens: 1000000 },
  { providerSlug: "gemini", name: "Gemini 2.0 Flash", modelId: "gemini-2.0-flash", upstreamModel: "gemini-2.0-flash", maxTokens: 1000000 },
  // DeepSeek
  { providerSlug: "deepseek", name: "DeepSeek V3", modelId: "deepseek-v3", upstreamModel: "deepseek_chat", maxTokens: 128000 },
  { providerSlug: "deepseek", name: "DeepSeek R1", modelId: "deepseek-r1", upstreamModel: "deepseek_r1", maxTokens: 128000 },
  // Claude
  { providerSlug: "claude", name: "Claude Opus 4", modelId: "claude-opus-4", upstreamModel: "claude-opus-4-20250514", maxTokens: 200000 },
  { providerSlug: "claude", name: "Claude Sonnet 4", modelId: "claude-sonnet-4", upstreamModel: "claude-sonnet-4-20250514", maxTokens: 200000 },
  // DouBao
  { providerSlug: "doubao", name: "DouBao", modelId: "doubao", upstreamModel: "doubao", maxTokens: 128000 },
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
