'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useStudioAccess } from '@/hooks/useStudioAccess';
import { BannerUploadSettings } from '@/components/settings/BannerUploadSettings';
import { AvatarUploadSettings } from '@/components/settings/AvatarUploadSettings';

type ChannelLinkDraft = { title: string; url: string };

export default function StudioBrandingPage() {
  const router = useRouter();
  const { user, refresh, isGuest, isCreator } = useAuth();
  const { isCollaborator } = useStudioAccess();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [links, setLinks] = useState<ChannelLinkDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isGuest) {
      router.replace('/login?next=/studio/branding');
      return;
    }
    if (!isCreator && !isCollaborator) {
      router.replace('/studio');
      return;
    }
    if (user) {
      setDisplayName(user.displayName ?? '');
      setBio(user.bio ?? '');
      setWebsiteUrl(user.websiteUrl ?? '');
      setLinks(
        (user.channelLinks ?? []).map((l) => ({
          title: l.title,
          url: l.url,
        })),
      );
    }
  }, [user, isGuest, isCreator, isCollaborator, router]);

  const handleSave = async () => {
    if (!user || !isCreator) return;
    setSaving(true);
    setMessage('');
    try {
      const cleanedLinks = links
        .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
        .filter((l) => l.title && l.url)
        .slice(0, 5);
      const { data } = await api.put(`/users/${user.id}`, {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        websiteUrl: websiteUrl.trim() || null,
        channelLinks: cleanedLinks,
      });
      localStorage.setItem('forge_user', JSON.stringify(data.data));
      refresh();
      setMessage('Channel branding saved.');
    } catch {
      setMessage('Could not save. Check that links use http:// or https://.');
    } finally {
      setSaving(false);
    }
  };

  if (isGuest || !user) return null;

  return (
    <main className="mx-auto max-w-2xl px-1 py-2">
      <PageHeader
        title="Customize channel"
        subtitle="Name, handle, about, and links shown on your public channel"
      />

      <form
        className="glass-panel mt-6 space-y-4 rounded-2xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        {message ? <p className="text-sm text-secondary">{message}</p> : null}

        {!isCreator ? (
          <p className="text-sm text-on-surface-variant">
            Only the channel owner can edit branding. Collaborators can use moderation tools.
          </p>
        ) : null}

        {isCreator ? (
          <>
            <AvatarUploadSettings />
            <BannerUploadSettings />
          </>
        ) : null}

        <label className="block">
          <span className="font-label-caps text-outline">Channel name</span>
          <Input
            className="mt-2"
            value={displayName}
            disabled={!isCreator}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="font-label-caps text-outline">Handle</span>
          <p className="mt-2 text-sm text-on-surface">@{user.username}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Handle changes are managed from account settings when available.
          </p>
        </label>

        <label className="block">
          <span className="font-label-caps text-outline">About</span>
          <textarea
            className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary disabled:opacity-60"
            rows={4}
            value={bio}
            disabled={!isCreator}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
          />
        </label>

        <label className="block">
          <span className="font-label-caps text-outline">Website</span>
          <Input
            className="mt-2"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            disabled={!isCreator}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </label>

        <div className="space-y-3 border-t border-outline-variant/20 pt-4">
          <h3 className="font-display-forge text-base font-semibold">Channel links</h3>
          <p className="text-sm text-on-surface-variant">Up to 5 links on your channel About tab.</p>
          <ul className="space-y-3">
            {links.map((link, index) => (
              <li key={index} className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[8rem] flex-1"
                  placeholder="Title"
                  value={link.title}
                  disabled={!isCreator}
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
                  disabled={!isCreator}
                  onChange={(e) => {
                    const next = [...links];
                    next[index] = { ...next[index], url: e.target.value };
                    setLinks(next);
                  }}
                />
                {isCreator ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {isCreator && links.length < 5 ? (
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => setLinks((prev) => [...prev, { title: '', url: '' }])}
            >
              Add link
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {isCreator ? (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
          <Link
            href={user.username ? `/${user.username}` : '/studio'}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm text-primary hover:underline"
          >
            View channel
          </Link>
        </div>
      </form>
    </main>
  );
}
