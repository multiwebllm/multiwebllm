import { BaseProvider, ProviderConfig } from "./base";
import { ChatGPTProvider } from "./chatgpt";
import { KimiProvider } from "./kimi";
import { GrokProvider } from "./grok";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";
import { CustomProvider, customProviderConfig } from "./custom";
import { isWebChatProvider } from "@/lib/models/catalog";

const providerMap: Record<
  string,
  new (config: ProviderConfig) => BaseProvider
> = {
  chatgpt: ChatGPTProvider,
  kimi: KimiProvider,
  grok: GrokProvider,
  gemini: GeminiProvider,
  claude: ClaudeProvider,
};

export function getProvider(
  slug: string,
  config: ProviderConfig
): BaseProvider {
  const ProviderClass = providerMap[slug];
  if (ProviderClass) {
    return new ProviderClass(config);
  }
  if (isWebChatProvider(slug)) {
    throw new Error(`Unknown built-in provider: ${slug}`);
  }
  return new CustomProvider(customProviderConfig(slug, config));
}

export { BaseProvider } from "./base";
export type { ProviderConfig, ChatOptions, SSEChunk, QuotaInfo } from "./base";
export { CustomProvider } from "./custom";
