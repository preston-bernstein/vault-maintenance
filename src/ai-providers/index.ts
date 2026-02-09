/**
 * AI provider dispatch. Maps provider id to env var and to the right completion function.
 * Add a new provider by implementing a completeX(prompt, config, apiKey) and wiring it here.
 */

import type { AIProviderId, AIConfig } from '../types.js';
import { completeClaude } from './claude.js';
import { completeOpenAI } from './openai.js';

/** Environment variable name for each provider's API key. */
export const PROVIDER_ENV: Record<AIProviderId, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
};

export function getApiKey(provider: AIProviderId): string | undefined {
  return process.env[PROVIDER_ENV[provider]];
}

export async function complete(
  prompt: string,
  config: AIConfig
): Promise<string | null> {
  const apiKey = getApiKey(config.provider);
  if (!apiKey) return null;

  switch (config.provider) {
    case 'claude':
      return completeClaude(prompt, config, apiKey);
    case 'openai':
      return completeOpenAI(prompt, config, apiKey);
    default:
      return null;
  }
}
