/**
 * Pluggable pre-publish content-safety scan (malware / CSAM / policy /
 * fingerprint match). No real scanner ships here — vendors like Google
 * CSAI Match, Thorn Safer, or Microsoft PhotoDNA require a legal agreement
 * and credentials this codebase can't obtain on its own. This defines the
 * integration point so one can be plugged in later without touching the
 * transcode pipeline again.
 */
export type ContentScanAction = 'approve' | 'hold' | 'block';

export interface ContentScanInput {
  videoId: string;
  userId: string;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
}

export interface ContentScanVerdict {
  action: ContentScanAction;
  /** Free-text category tags from the provider, e.g. ["csam"], ["malware"], [] when clean. */
  categories: string[];
  provider: string;
  /** Raw provider response, for admin review / debugging — never shown to end users. */
  raw?: unknown;
}

export interface ContentScanProvider {
  readonly name: string;
  scan(input: ContentScanInput): Promise<ContentScanVerdict>;
}
