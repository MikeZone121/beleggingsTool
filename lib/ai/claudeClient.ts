const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Headline summarization is a small, repetitive task — Haiku is the
// right-sized model for it, not the flagship Sonnet/Opus tier.
const MODEL = "claude-haiku-4-5-20251001";
const REQUEST_TIMEOUT_MS = 20_000;

export class ClaudeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeError";
  }
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Thin wrapper over the Messages API via plain `fetch` (no SDK dependency,
 * consistent with how `yahooFinance.ts` calls its own vendor directly).
 * Throws `ClaudeError` rather than returning null on failure — callers
 * (see `lib/insights/newsInsightsService.ts`) catch per-holding so one
 * failed summary doesn't take down the whole batch.
 */
export async function summarizeWithClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeError("ANTHROPIC_API_KEY is not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ClaudeError(
      `Claude API request failed: ${error instanceof Error ? error.message : "network error"}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ClaudeError(
      `Claude API request failed with status ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new ClaudeError("Claude API returned an unexpected response shape");
  }
  return text.trim();
}
