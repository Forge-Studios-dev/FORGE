'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import {
  engageErrorReason,
  getChannelSubscription,
  setChannelNotifyLevel,
  toggleSubscribe,
  type ChannelNotifyLevel,
} from '@/lib/engage-mutations';
import {
  getEngageBlockReason,
  type EngageBlockReason,
} from '@/lib/engage-access';

type Variant = 'pill' | 'channel';

interface Props {
  channelId: string;
  initialSubscribed?: boolean;
  /** Guest watch surface: tap Subscribe opens gate instead of mutating. */
  onGuestAction?: () => void;
  onEngageBlock?: (reason: EngageBlockReason) => void;
  onEngageError?: (message: string) => void;
  variant?: Variant;
  className?: string;
}

const NOTIFY_OPTIONS = [
  { level: 'all' as const, label: 'All', icon: 'notifications_active' },
  { level: 'personalized' as const, label: 'Personalized', icon: 'notifications' },
  { level: 'none' as const, label: 'None', icon: 'notifications_off' },
] as const;

export function SubscribeChannelControl({
  channelId,
  initialSubscribed = false,
  onGuestAction,
  onEngageBlock,
  onEngageError,
  variant = 'pill',
  className = '',
}: Props) {
  const { user: me, isGuest } = useAuth();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifyLevel, setNotifyLevel] = useState<ChannelNotifyLevel>('all');
  const rootRef = useRef<HTMLDivElement>(null);
  const blockReason = onGuestAction ? null : getEngageBlockReason(me, isGuest);

  useEffect(() => {
    setSubscribed(initialSubscribed);
    setMenuOpen(false);
  }, [channelId, initialSubscribed]);

  useEffect(() => {
    if (isGuest || !me || !subscribed) return;
    let cancelled = false;
    void getChannelSubscription(channelId)
      .then((sub) => {
        if (!cancelled && sub.notifyLevel) setNotifyLevel(sub.notifyLevel);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, isGuest, me, subscribed]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const gated = (fn: () => void) => {
    if (onGuestAction) {
      onGuestAction();
      return;
    }
    if (blockReason) {
      onEngageBlock?.(blockReason);
      return;
    }
    fn();
  };

  const subscribeMutation = useMutation({
    mutationFn: (nextSubscribed: boolean) => toggleSubscribe(channelId, !nextSubscribed),
    onMutate: (nextSubscribed) => {
      setSubscribed(nextSubscribed);
      if (!nextSubscribed) setMenuOpen(false);
      if (nextSubscribed) setNotifyLevel('all');
    },
    onError: (err, nextSubscribed) => {
      setSubscribed(!nextSubscribed);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') {
        onEngageBlock?.(reason);
      } else {
        onEngageError?.('Could not update subscription. Try again.');
      }
    },
  });

  const notifyMutation = useMutation({
    mutationFn: (level: ChannelNotifyLevel) => setChannelNotifyLevel(channelId, level),
    onMutate: (level) => {
      setNotifyLevel(level);
      setMenuOpen(false);
    },
    onError: () => {
      onEngageError?.('Could not update notification preference.');
      void getChannelSubscription(channelId).then((sub) => {
        if (sub.notifyLevel) setNotifyLevel(sub.notifyLevel);
      });
    },
  });

  const subscribedBtn =
    variant === 'channel'
      ? 'inline-flex items-center gap-2 rounded-xl border border-outline-variant px-6 py-2 font-semibold text-on-surface disabled:opacity-60'
      : 'inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-60';

  const subscribeBtn =
    variant === 'channel'
      ? 'primary-button shrink-0 rounded-xl px-6 py-2 font-semibold text-on-primary disabled:opacity-60'
      : 'primary-button rounded-full px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-60';

  if (onGuestAction) {
    return (
      <button type="button" onClick={onGuestAction} className={`${subscribeBtn} ${className}`}>
        Subscribe
      </button>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {subscribed ? (
        <>
          <button
            type="button"
            disabled={subscribeMutation.isPending}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={subscribedBtn}
          >
            <Icon
              name={
                notifyLevel === 'none'
                  ? 'notifications_off'
                  : notifyLevel === 'personalized'
                    ? 'notifications'
                    : 'notifications_active'
              }
              className="text-base"
            />
            Subscribed
            <Icon name="expand_more" className="text-base" />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute left-0 z-20 mt-2 min-w-[220px] rounded-xl border border-outline-variant/30 bg-surface-container-high p-1 shadow-lg"
            >
              {NOTIFY_OPTIONS.map((opt) => (
                <button
                  key={opt.level}
                  type="button"
                  role="menuitem"
                  disabled={notifyMutation.isPending}
                  onClick={() => notifyMutation.mutate(opt.level)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container ${
                    notifyLevel === opt.level ? 'text-primary' : 'text-on-surface'
                  }`}
                >
                  <Icon name={opt.icon} className="text-base" />
                  {opt.label}
                </button>
              ))}
              <div className="my-1 border-t border-outline-variant/20" />
              <button
                type="button"
                role="menuitem"
                disabled={subscribeMutation.isPending}
                onClick={() => gated(() => subscribeMutation.mutate(false))}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-surface-container"
              >
                <Icon name="person_remove" className="text-base" />
                Unsubscribe
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          disabled={subscribeMutation.isPending}
          onClick={() => gated(() => subscribeMutation.mutate(true))}
          className={subscribeBtn}
        >
          Subscribe
        </button>
      )}
    </div>
  );
}
