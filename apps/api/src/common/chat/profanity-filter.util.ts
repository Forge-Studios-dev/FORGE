const DEFAULT_BLOCKLIST = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'damn',
  'cunt',
  'dick',
  'pussy',
  'nigger',
  'nigga',
  'faggot',
  'retard',
];

export function maskProfanity(text: string, enabled = true): string {
  if (!enabled || !text.trim()) return text;
  let result = text;
  for (const word of DEFAULT_BLOCKLIST) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(re, '*'.repeat(Math.min(word.length, 4)));
  }
  return result;
}
