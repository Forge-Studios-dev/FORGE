import { Logger } from '@nestjs/common';

export type ChatModerationResult = {
  allowed: boolean;
  reason?: string;
  categories?: string[];
};

const HARD_BLOCK = [
  'kill yourself',
  'kys',
  'child porn',
  'cp ',
  'bomb threat',
];

const logger = new Logger('ChatAiModeration');

export async function moderateChatMessage(
  body: string,
  opts?: { openAiKey?: string; enabled?: boolean },
): Promise<ChatModerationResult> {
  if (opts?.enabled === false) return { allowed: true };

  const normalized = body.trim().toLowerCase();
  if (!normalized) return { allowed: false, reason: 'empty_message' };

  for (const phrase of HARD_BLOCK) {
    if (normalized.includes(phrase)) {
      return { allowed: false, reason: 'blocked_content', categories: ['severe'] };
    }
  }

  const key = opts?.openAiKey?.trim();
  if (!key) return { allowed: true };

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: body }),
    });
    if (!res.ok) {
      logger.warn(`OpenAI moderation HTTP ${res.status}`);
      return { allowed: true };
    }
    const json = (await res.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
      }>;
    };
    const result = json.results?.[0];
    if (!result?.flagged) return { allowed: true };

    const categories = Object.entries(result.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    return {
      allowed: false,
      reason: 'ai_moderation',
      categories,
    };
  } catch (err) {
    logger.warn(`OpenAI moderation failed: ${(err as Error).message}`);
    return { allowed: true };
  }
}
