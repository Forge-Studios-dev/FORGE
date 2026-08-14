import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentScanInput, ContentScanProvider, ContentScanVerdict } from './content-scan.types';
import { NoopContentScanProvider } from './providers/noop-content-scan.provider';
import { WebhookContentScanProvider } from './providers/webhook-content-scan.provider';

@Injectable()
export class ContentScanService {
  private readonly logger = new Logger(ContentScanService.name);
  private readonly provider: ContentScanProvider;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.buildProvider();
  }

  private buildProvider(): ContentScanProvider {
    const kind = this.configService.get<string>('contentScan.provider') || 'none';
    if (kind === 'webhook') {
      const url = this.configService.get<string>('contentScan.webhookUrl');
      if (!url) {
        this.logger.warn('CONTENT_SCAN_PROVIDER=webhook but CONTENT_SCAN_WEBHOOK_URL is unset — falling back to noop');
        return new NoopContentScanProvider();
      }
      return new WebhookContentScanProvider({
        url,
        authToken: this.configService.get<string>('contentScan.webhookToken') || undefined,
        timeoutMs: this.configService.get<number>('contentScan.timeoutMs') ?? 15_000,
      });
    }
    return new NoopContentScanProvider();
  }

  isEnabled(): boolean {
    return this.provider.name !== 'noop';
  }

  async scanVideo(input: ContentScanInput): Promise<ContentScanVerdict> {
    const verdict = await this.provider.scan(input);
    if (verdict.action !== 'approve') {
      this.logger.warn(
        `Content scan flagged video ${input.videoId}: action=${verdict.action} categories=${verdict.categories.join(',')} provider=${verdict.provider}`,
      );
    }
    return verdict;
  }
}
