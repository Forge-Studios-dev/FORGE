'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Icon } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
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
import { PopoverMenu } from '@/components/shell/PopoverMenu';

type Variant = 'pill' | 'channel';

interface Props {
  channelId: string;
  initialSubscribed?: boolean;
  /** Skip per-row GET /subscription when list already returned notifyLevel. */
  initialNotifyLevel?: ChannelNotifyLevel;
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
  initialNotifyLevel,
  onGuestAction,
  onEngageBlock,
  onEngageError,
  variant = 'pill',
  className = '',
}: Props) {
  const { user: me, isGuest } = useAuth();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [confirmUnsub, setConfirmUnsub] = useState(false);
  const [notifyLevel, setNotifyLevel] = useState<ChannelNotifyLevel>(initialNotifyLevel ?? 'all');
  const blockReason = onGuestAction ? null : getEngageBlockReason(me, isGuest);

  useEffect(() => {
    setSubscribed(initialSubscribed);
    setConfirmUnsub(false);
    if (initialNotifyLevel) setNotifyLevel(initialNotifyLevel);
  }, [channelId, initialSubscribed, initialNotifyLevel]);

  useEffect(() => {
    if (isGuest || !me || !subscribed) return;
    if (initialNotifyLevel) return;
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
  }, [channelId, isGuest, me, subscribed, initialNotifyLevel]);

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
    <div className={`relative ${className}`}>
      {subscribed ? (
        <>
          <PopoverMenu
            label="Subscription options"
            align="left"
            panelClassName="min-w-[220px] p-1"
            triggerClassName={subscribedBtn}
            trigger={
              <>
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
              </>
            }
          >
            {(close) => (
              <>
                {NOTIFY_OPTIONS.map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    role="menuitemradio"
                    aria-checked={notifyLevel === opt.level}
                    disabled={notifyMutation.isPending || subscribeMutation.isPending}
                    onClick={() => {
                      notifyMutation.mutate(opt.level);
                      close();
                    }}
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
                  onClick={() => {
                    close();
                    setConfirmUnsub(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-surface-container"
                >
                  <Icon name="person_remove" className="text-base" />
                  Unsubscribe
                </button>
              </>
            )}
          </PopoverMenu>
          <ConfirmDialog
            open={confirmUnsub}
            title="Unsubscribe?"
            description="You will stop receiving updates from this channel."
            confirmLabel="Unsubscribe"
            cancelLabel="Cancel"
            variant="danger"
            loading={subscribeMutation.isPending}
            onCancel={() => setConfirmUnsub(false)}
            onConfirm={() =>
              gated(() => {
                setConfirmUnsub(false);
                subscribeMutation.mutate(false);
              })
            }
          />
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
