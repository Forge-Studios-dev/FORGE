import { ContentScanInput, ContentScanProvider, ContentScanVerdict } from '../content-scan.types';

/** Default when no scanner is configured — approves everything. Preserves today's behavior exactly. */
export class NoopContentScanProvider implements ContentScanProvider {
  readonly name = 'noop';

  async scan(_input: ContentScanInput): Promise<ContentScanVerdict> {
    return { action: 'approve', categories: [], provider: this.name };
  }
}
