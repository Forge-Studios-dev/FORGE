'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { ActiveSessions } from '@/components/settings/ActiveSessions';
import { AvatarUploadSettings } from '@/components/settings/AvatarUploadSettings';
import { BannerUploadSettings } from '@/components/settings/BannerUploadSettings';
import { MutedChannelsSettings } from '@/components/settings/MutedChannelsSettings';
import { BlockedUsersSettings } from '@/components/settings/BlockedUsersSettings';
import { InterestsSettings } from '@/components/settings/InterestsSettings';
import { PasswordResetSettings } from '@/components/settings/PasswordResetSettings';
import { PlaybackSettings } from '@/components/settings/PlaybackSettings';
import { WatchHistoryPrivacyToggle } from '@/components/settings/WatchHistoryPrivacyToggle';
import {
  formatUsernameUnlockDate,
  usernameRenameUnlockAt,
} from '@/lib/username-cooldown';

type ChannelLinkDraft = { title: string; url: string };

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user: stored, refresh, isGuest } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [links, setLinks] = useState<ChannelLinkDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isGuest) {
      router.replace('/login?next=/profile/settings');
      return;
    }
    if (stored) {
      setUsername(stored.username ?? '');
      setDisplayName(stored.displayName ?? '');
      setBio(stored.bio ?? '');
      setWebsiteUrl(stored.websiteUrl ?? '');
      setLinks(
        (stored.channelLinks ?? []).map((l) => ({
          title: l.title,
          url: l.url,
        })),
      );
    }
  }, [stored, isGuest, router]);

  const handleSave = async () => {
    if (!stored) return;
    setSaving(true);
    setMessage('');
    try {
      const cleanedLinks = links
        .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
        .filter((l) => l.title && l.url)
        .slice(0, 5);
      const nextUsername = username.trim().replace(/^@/, '');
      const usernameLocked = usernameRenameUnlockAt(stored.usernameChangedAt) !== null;
      const { data } = await api.put(`/users/${stored.id}`, {
        ...(usernameLocked ? {} : { username: nextUsername }),
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        websiteUrl: websiteUrl.trim() || null,
        channelLinks: cleanedLinks,
      });
      const updated = data.data;
      localStorage.setItem('forge_user', JSON.stringify(updated));
      refresh();
      setUsername(updated.username ?? nextUsername);
      setMessage('Settings saved.');
    } catch (err: unknown) {
      const apiMsg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      const text = Array.isArray(apiMsg) ? apiMsg[0] : typeof apiMsg === 'string' ? apiMsg : null;
      setMessage(text || 'Could not save settings. Check username and that links use http:// or https://.');
    } finally {
      setSaving(false);
    }
  };

  if (isGuest || !stored) return null;

  const usernameUnlockAt = usernameRenameUnlockAt(stored.usernameChangedAt);
  const usernameLocked = usernameUnlockAt !== null;

  return (
    <main className="mx-auto max-w-xl px-5 py-8 md:px-12">
      <Link href={`/${stored.username}`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Profile
      </Link>
      <PageHeader title="Settings" subtitle="Manage your account preferences" />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Settings sections">
        <a href="#account" className="rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">
          Account
        </a>
        <a
          href="#links"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Links
        </a>
        <a
          href="#privacy"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Privacy
        </a>
        <a
          href="#playback"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Playback
        </a>
        <a
          href="#interests"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Interests
        </a>
        <Link
          href="/notifications"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Notifications
        </Link>
        <Link
          href="/settings/memberships"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Memberships
        </Link>
        <a
          href="#security"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Security
        </a>
        <a
          href="#recommendations"
          className="rounded-full bg-surface-container-high px-4 py-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          Recommendations
        </a>
      </nav>

      <form
        id="account"
        className="glass-panel space-y-4 rounded-2xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <h2 className="font-display-forge text-lg font-semibold">Account</h2>
        <AvatarUploadSettings />
        <BannerUploadSettings />
        <label className="block">
          <span className="font-label-caps text-outline">Username</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-on-surface-variant">@</span>
            <Input
              className="flex-1"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
              autoComplete="username"
              spellCheck={false}
              disabled={usernameLocked}
              readOnly={usernameLocked}
              aria-disabled={usernameLocked}
            />
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {usernameLocked && usernameUnlockAt
              ? `Handle locked until ${formatUsernameUnlockDate(usernameUnlockAt)} (once every 14 days).`
              : 'Letters, numbers, and underscores · 3–30 characters. You can change your handle once every 14 days.'}{' '}
            Your channel URL is{' '}
            <Link href={`/${stored.username}`} className="text-primary hover:underline">
              /{stored.username}
            </Link>
            .
          </p>
        </label>
        {message ? <p className="text-sm text-secondary">{message}</p> : null}
        <label className="block">
          <span className="font-label-caps text-outline">Display name</span>
          <Input className="mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-label-caps text-outline">Bio</span>
          <textarea
            className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>

        <div id="links" className="space-y-3 border-t border-outline-variant/20 pt-4">
          <h3 className="font-display-forge text-base font-semibold">Channel links</h3>
          <p className="text-sm text-on-surface-variant">
            Shown on your channel About tab (YouTube-style links).
          </p>
          <label className="block">
            <span className="font-label-caps text-outline">Website</span>
            <Input
              className="mt-2"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </label>
          <ul className="space-y-3">
            {links.map((link, index) => (
              <li key={index} className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[8rem] flex-1"
                  placeholder="Title"
                  value={link.title}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = { ...next[index], title: e.target.value };
                    setLinks(next);
                  }}
                />
                <Input
                  className="min-w-[12rem] flex-[2]"
                  type="url"
                  placeholder="https://"
                  value={link.url}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = { ...next[index], url: e.target.value };
                    setLinks(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, i) => i !== index))}
                  className="rounded-full px-3 text-sm text-on-surface-variant hover:text-error"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {links.length < 5 ? (
            <button
              type="button"
              onClick={() => setLinks([...links, { title: '', url: '' }])}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Add link
            </button>
          ) : null}
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      <PasswordResetSettings />

      <section id="privacy" className="glass-panel mt-8 rounded-2xl p-6">
        <h2 className="font-display-forge text-lg font-semibold">Privacy</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Manage watch history and what you keep on this device.
        </p>
        <WatchHistoryPrivacyToggle />
        <Link href="/history" className="mt-3 inline-block text-sm text-primary hover:underline">
          Watch history →
        </Link>
      </section>

      <PlaybackSettings />

      <section className="glass-panel mt-8 rounded-2xl p-6">
        <h2 className="font-display-forge text-lg font-semibold">Notifications</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Uploads, live streams, comments, and channel updates.
        </p>
        <Link href="/notifications" className="mt-3 inline-block text-sm text-primary hover:underline">
          Open notifications →
        </Link>
      </section>

      <section className="glass-panel mt-8 rounded-2xl p-6">
        <h2 className="font-display-forge text-lg font-semibold">Memberships</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          View and manage your channel memberships.
        </p>
        <Link href="/settings/memberships" className="mt-3 inline-block text-sm text-primary hover:underline">
          My memberships →
        </Link>
      </section>

      <MutedChannelsSettings />

      <BlockedUsersSettings />

      <InterestsSettings />

      <section className="glass-panel mt-8 rounded-2xl p-6">
        <div className="mt-4">
          <ActiveSessions />
        </div>
      </section>
    </main>
  );
}
