import { Logger } from '@nestjs/common';
import { ContentScanInput, ContentScanProvider, ContentScanVerdict } from '../content-scan.types';

export type WebhookContentScanConfig = {
  url: string;
  authToken?: string;
  timeoutMs: number;
};

/**
 * Generic REST integration point: POSTs the video's public URLs to a
 * configured endpoint and expects `{ action: "approve"|"hold"|"block", categories?: string[] }`
 * back. Fits any vendor with a synchronous scan API — point `url` at
 * whichever one gets integrated.
 *
 * Fails closed (`hold`) on any error — this is a safety scan; a hold just
 * queues the video for human review, it doesn't destroy anything, so
 * erring toward caution when the scanner is unreachable is the right
 * default (unlike most integrations in this codebase, which fail open).
 */
export class WebhookContentScanProvider implements ContentScanProvider {
  readonly name = 'webhook';
  private readonly logger = new Logger(WebhookContentScanProvider.name);

  constructor(private readonly config: WebhookContentScanConfig) {}

  async scan(input: ContentScanInput): Promise<ContentScanVerdict> {
    try {
      const res = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.authToken ? { Authorization: `Bearer ${this.config.authToken}` } : {}),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!res.ok) {
        throw new Error(`scan endpoint returned ${res.status}`);
      }

      const body = (await res.json()) as { action?: string; categories?: string[] };
      const action = this.normalizeAction(body.action);
      return {
        action,
        categories: Array.isArray(body.categories) ? body.categories : [],
        provider: this.name,
        raw: body,
      };
    } catch (err) {
      this.logger.warn(
        `Content scan webhook failed for video ${input.videoId}: ${err instanceof Error ? err.message : err} — holding for manual review (fail-closed)`,
      );
      return { action: 'hold', categories: ['scan_unavailable'], provider: this.name };
    }
  }

  private normalizeAction(value: string | undefined): 'approve' | 'hold' | 'block' {
    if (value === 'approve' || value === 'hold' || value === 'block') return value;
    // An unrecognized response is treated the same as unavailable — fail closed.
    return 'hold';
  }
}
