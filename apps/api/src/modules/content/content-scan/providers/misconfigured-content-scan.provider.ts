import { ContentScanInput, ContentScanProvider, ContentScanVerdict } from '../content-scan.types';

/**
 * Used when CONTENT_SCAN_PROVIDER=webhook but CONTENT_SCAN_WEBHOOK_URL is missing.
 * Always holds — never approve-all (noop). Aligns with webhook fail-closed posture.
 */
export class MisconfiguredContentScanProvider implements ContentScanProvider {
  readonly name = 'misconfigured';

  async scan(_input: ContentScanInput): Promise<ContentScanVerdict> {
    return {
      action: 'hold',
      categories: ['scan_misconfigured'],
      provider: this.name,
    };
  }
}
