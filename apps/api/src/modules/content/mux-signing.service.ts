import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  appendMuxToken,
  signMuxPlaybackToken,
} from '../../common/media/mux-signing.util';
import { muxHlsPlaybackUrl, muxPlaybackIdFromHlsUrl } from '../../common/media/mux-playback.util';
import { sanitizeHlsUrl, sanitizeThumbnailUrl } from '../../common/media/playback-url.util';

/** Whether content visibility requires signed playback (non-public catalog). */
export function visibilityRequiresSignedPlayback(visibility: string): boolean {
  return !['public', 'unlisted'].includes(visibility);
}

@Injectable()
export class MuxSigningService {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const keyId = this.configService.get<string>('mux.signingKeyId') || '';
    const privateKey = this.configService.get<string>('mux.signingPrivateKey') || '';
    return keyId.length > 0 && privateKey.length > 0;
  }

  /** Sign Mux HLS URL when signing keys are configured and content is gated. */
  signPlaybackUrl(
    hlsUrl: string | null | undefined,
    visibility: string,
  ): string | null {
    const safe = sanitizeHlsUrl(hlsUrl);
    if (!safe) return null;
    if (!visibilityRequiresSignedPlayback(visibility)) return safe;
    if (!this.isConfigured()) return safe;

    const playbackId = muxPlaybackIdFromHlsUrl(safe);
    if (!playbackId) return safe;

    const ttlSec = this.configService.get<number>('mux.signedPlaybackTtlSec') || 3600;
    const token = signMuxPlaybackToken(
      playbackId,
      this.configService.get<string>('mux.signingKeyId')!,
      this.configService.get<string>('mux.signingPrivateKey')!,
      ttlSec,
    );
    return appendMuxToken(safe, token);
  }

  signThumbnailUrl(
    thumbnailUrl: string | null | undefined,
    visibility: string,
  ): string | null {
    const safe = sanitizeThumbnailUrl(thumbnailUrl);
    if (!safe) return null;
    if (!visibilityRequiresSignedPlayback(visibility)) return safe;
    if (!this.isConfigured() || !safe.includes('image.mux.com')) return safe;

    const playbackId = muxPlaybackIdFromHlsUrl(safe.replace('image.mux.com', 'stream.mux.com'));
    if (!playbackId) return safe;

    const ttlSec = this.configService.get<number>('mux.signedPlaybackTtlSec') || 3600;
    const token = signMuxPlaybackToken(
      playbackId,
      this.configService.get<string>('mux.signingKeyId')!,
      this.configService.get<string>('mux.signingPrivateKey')!,
      ttlSec,
    );
    return appendMuxToken(safe, token);
  }

  /** Playback policy for Mux asset/live stream creation. */
  playbackPolicyForVisibility(visibility: string): Array<'public' | 'signed'> {
    if (visibilityRequiresSignedPlayback(visibility) && this.isConfigured()) {
      return ['signed'];
    }
    return ['public'];
  }

  buildHlsUrl(playbackId: string, visibility: string): string {
    const base = muxHlsPlaybackUrl(playbackId);
    return this.signPlaybackUrl(base, visibility) ?? base;
  }
}
