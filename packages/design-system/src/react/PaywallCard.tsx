import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';

/**
 * Single restricted-content presentation used everywhere a viewer hits a
 * paywall (watch page, community premium posts, memberships) — shows the
 * specific tier and price that unlocks the content inline, no extra click,
 * instead of each surface rolling its own "restricted" box. Checkout/subscribe
 * actions are app-specific (Stripe, mock membership) so they're passed as
 * `children` rather than owned by this component.
 */
export function PaywallCard({
  title = 'Content restricted',
  message,
  tierName,
  priceLabel,
  children,
  aspectVideo = true,
}: {
  title?: string;
  message: string;
  /** Name of the tier that unlocks this content, when known. */
  tierName?: string;
  /** Pre-formatted price, e.g. "USD 29/mo". */
  priceLabel?: string;
  children?: ReactNode;
  /** Video-shaped box (watch page default). Set false for membership/community surfaces. */
  aspectVideo?: boolean;
}) {
  return (
    <div
      className={`glass-panel flex flex-col items-center justify-center gap-3 rounded-xl px-6 text-center ${aspectVideo ? 'aspect-video' : 'py-10'}`}
    >
      <Icon name="lock" className="text-3xl text-outline" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-on-surface-variant">{message}</p>
      {tierName ? (
        <StatusPill tone="primary" label={`Unlock with ${tierName}${priceLabel ? ` — ${priceLabel}` : ''}`} />
      ) : null}
      {children}
    </div>
  );
}
