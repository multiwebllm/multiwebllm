import { BaseProvider, ProviderConfig } from "./base";
import { ChatGPTProvider } from "./chatgpt";
import { KimiProvider } from "./kimi";
import { MinimaxProvider } from "./minimax";
import { GrokProvider } from "./grok";
import { GeminiProvider } from "./gemini";
import { DeepSeekProvider } from "./deepseek";
import { ClaudeProvider } from "./claude";
import { DouBaoProvider } from "./doubao";

const providerMap: Record<
  string,
  new (config: ProviderConfig) => BaseProvider
> = {
  chatgpt: ChatGPTProvider,
  kimi: KimiProvider,
  minimax: MinimaxProvider,
  grok: GrokProvider,
  gemini: GeminiProvider,
  deepseek: DeepSeekProvider,
  claude: ClaudeProvider,
  doubao: DouBaoProvider,
};

export function getProvider(
  slug: string,
  config: ProviderConfig
): BaseProvider {
  const ProviderClass = providerMap[slug];
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${slug}`);
  }
  return new ProviderClass(config);
}

export { BaseProvider } from "./base";
export type { ProviderConfig, ChatOptions, SSEChunk, QuotaInfo } from "./base";
