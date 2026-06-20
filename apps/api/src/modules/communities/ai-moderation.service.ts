import { Injectable } from '@nestjs/common';

const SPAM_PATTERNS = [
  /\b(buy now|click here|free money|crypto pump)\b/i,
  /(https?:\/\/){2,}/i,
  /(.)\1{8,}/,
];

@Injectable()
export class AiModerationService {
  scoreSpam(text: string): { score: number; flagged: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(text)) {
        score += 0.4;
        reasons.push('pattern_match');
      }
    }
    if (text.length > 800) {
      score += 0.2;
      reasons.push('length');
    }
    const flagged = score >= 0.4;
    return { score: Math.min(1, score), flagged, reasons };
  }
}
