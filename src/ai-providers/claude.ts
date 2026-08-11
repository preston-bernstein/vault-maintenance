/**
 * Claude (Anthropic) provider. Uses dynamic import so the SDK is optional.
 */

import type { AIConfig } from '../types.js';
import { formatError } from '../utils/fs-helpers.js';
import { log } from '../utils/logger.js';

export async function completeClaude(
  prompt: string,
  config: AIConfig,
  apiKey: string,
  verbose = false,
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
  } catch (err) {
    await log(verbose, `AI suggestions failed: ${formatError(err)}\n`);
    return null;
  }
}

async function loadAnthropicSDK() {
  try {
    const mod = await import('@anthropic-ai/sdk');
    return mod.default;
  } catch {
    const msg = 'AI suggestions skipped: @anthropic-ai/sdk not installed\n';
    process.stderr.write(msg);
    const { writeLogLine, isLogging } = await import('../utils/logger.js');
    if (isLogging()) void writeLogLine(msg);
    return null;
  }
}
