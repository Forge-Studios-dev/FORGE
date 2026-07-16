'use client';

/**
 * Client-side-only UX hint (LOW-05) — mirrors the server's actual rule
 * (SignupDto: min 8 chars, upper+lower+digit) plus soft bonus signals.
 * The server (signup.dto.ts) remains the sole authoritative check.
 */
type Strength = 'empty' | 'weak' | 'fair' | 'strong';

function scorePassword(password: string): Strength {
  if (!password) return 'empty';

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const meetsServerRule = password.length >= 8 && hasLower && hasUpper && hasDigit;

  if (!meetsServerRule) return 'weak';

  let bonus = 0;
  if (password.length >= 12) bonus += 1;
  if (hasSymbol) bonus += 1;

  return bonus >= 1 ? 'strong' : 'fair';
}

const STRENGTH_COPY: Record<Exclude<Strength, 'empty'>, string> = {
  weak: 'Weak — needs 8+ characters with upper, lower & a number',
  fair: 'Fair — meets requirements',
  strong: 'Strong',
};

const STRENGTH_BAR_CLASS: Record<Exclude<Strength, 'empty'>, string> = {
  weak: 'w-1/3 bg-error',
  fair: 'w-2/3 bg-warning',
  strong: 'w-full bg-success',
};

const STRENGTH_TEXT_CLASS: Record<Exclude<Strength, 'empty'>, string> = {
  weak: 'text-error',
  fair: 'text-warning',
  strong: 'text-success',
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = scorePassword(password);
  if (strength === 'empty') return null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full transition-all ${STRENGTH_BAR_CLASS[strength]}`}
        />
      </div>
      <p className={`text-xs ${STRENGTH_TEXT_CLASS[strength]}`}>{STRENGTH_COPY[strength]}</p>
    </div>
  );
}
