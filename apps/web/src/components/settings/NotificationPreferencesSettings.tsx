'use client';

import { useEffect, useState } from 'react';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@forge/shared-types';
import { api } from '@/lib/api';
import { CATEGORY_LABEL } from '@/lib/notification-category';

type NotificationPreferences = {
  mutedCategories: NotificationCategory[];
  emailDigest: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = { mutedCategories: [], emailDigest: false };

/** Per-category notification toggles + email digest opt-in, synced to the account. */
export function NotificationPreferencesSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ data: NotificationPreferences }>(
          '/users/me/notification-preferences',
        );
        if (!cancelled) setPrefs({ ...DEFAULT_PREFS, ...data.data });
      } catch {
        // Keep defaults (all categories on, digest off) if the fetch fails.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: NotificationPreferences) => {
    const previous = prefs;
    setError('');
    setPrefs(next);
    setSaving(true);
    try {
      await api.put('/users/me/notification-preferences', next);
    } catch {
      setPrefs(previous);
      setError('Could not update notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category: NotificationCategory, enabled: boolean) => {
    const mutedCategories = enabled
      ? prefs.mutedCategories.filter((c) => c !== category)
      : [...new Set([...prefs.mutedCategories, category])];
    void save({ ...prefs, mutedCategories });
  };

  const toggleDigest = (emailDigest: boolean) => {
    void save({ ...prefs, emailDigest });
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="font-label-caps text-xs text-outline">Notify me about</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const enabled = !prefs.mutedCategories.includes(category);
          return (
            <label key={category} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={loading || saving}
                onChange={(e) => toggleCategory(category, e.target.checked)}
              />
              <span className="text-on-surface">{CATEGORY_LABEL[category]}</span>
            </label>
          );
        })}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-outline-variant/20 pt-4">
        <input
          type="checkbox"
          className="mt-1"
          checked={prefs.emailDigest}
          disabled={loading || saving}
          onChange={(e) => toggleDigest(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-on-surface">Email digest</span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            Occasional email summary of activity on your account.
          </span>
        </span>
      </label>

      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
