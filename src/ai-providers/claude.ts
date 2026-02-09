/**
 * Claude (Anthropic) provider. Uses dynamic import so the SDK is optional.
 */

import type { AIConfig } from '../types.js';

export const CLAUDE_ENV_KEY = 'ANTHROPIC_API_KEY';

export async function completeClaude(
  prompt: string,
  config: AIConfig,
  apiKey: string
): Promise<string | null> {
  try {
    const Anthropic = await loadAnthropicSDK();
    if (!Anthropic) return null;
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '';
    return text;
  } catch {
    return null;
  }
}

async function loadAnthropicSDK() {
  try {
    const mod = await import('@anthropic-ai/sdk');
    return mod.default;
  } catch {
    process.stderr.write(
      'AI suggestions skipped: @anthropic-ai/sdk not installed\n'
    );
    return null;
  }
}
