import { db } from "./index";
import { providers, models } from "./schema";
import { MODEL_CATALOG, WEB_CHAT_PROVIDER_SLUGS } from "@/lib/models/catalog";

const defaultProviders = [
  {
    name: "ChatGPT",
    slug: "chatgpt",
    baseUrl: "https://chatgpt.com",
    authType: "cookie" as const,
  },
  {
    name: "Claude",
    slug: "claude",
    baseUrl: "https://claude.ai",
    authType: "cookie" as const,
  },
  {
    name: "Gemini",
    slug: "gemini",
    baseUrl: "https://gemini.google.com",
    authType: "cookie" as const,
  },
  {
    name: "Grok",
    slug: "grok",
    baseUrl: "https://grok.com",
    authType: "cookie" as const,
  },
  {
    name: "Kimi",
    slug: "kimi",
    baseUrl: "https://kimi.moonshot.cn",
    authType: "cookie" as const,
  },
];

const defaultModels = MODEL_CATALOG;

async function seed() {
  console.log("Seeding providers...");

  for (const p of defaultProviders) {
    await db
      .insert(providers)
      .values(p)
      .onConflictDoNothing({ target: providers.slug });
  }

  console.log("Seeding models...");

  const allProviders = await db.select().from(providers);
  const slugToId = Object.fromEntries(allProviders.map((p) => [p.slug, p.id]));

  for (const m of defaultModels) {
    if (!WEB_CHAT_PROVIDER_SLUGS.includes(m.providerSlug as (typeof WEB_CHAT_PROVIDER_SLUGS)[number])) {
      continue;
    }
    const providerId = slugToId[m.providerSlug];
    if (!providerId) continue;
    await db
      .insert(models)
      .values({
        providerId,
        name: m.name,
        modelId: m.modelId,
        upstreamModel: m.upstreamModel,
        maxTokens: m.maxTokens ?? null,
        contextWindow: m.contextWindow ?? null,
        supportsVision: m.supportsVision ?? false,
        supportsImageGen: m.supportsImageGen ?? false,
        modelKind: m.modelKind ?? (m.supportsImageGen ? "image" : "chat"),
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
