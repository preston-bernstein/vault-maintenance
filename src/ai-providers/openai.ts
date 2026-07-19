/**
 * OpenAI provider. Uses fetch to the REST API (no SDK dependency).
 */

import type { AIConfig } from "../types.js";

export const OPENAI_ENV_KEY = "OPENAI_API_KEY";

export async function completeOpenAI(
  prompt: string,
  config: AIConfig,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return content;
}
