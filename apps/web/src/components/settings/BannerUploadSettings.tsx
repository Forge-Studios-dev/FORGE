'use client';

import { useRef, useState } from 'react';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const MAX_BANNER_BYTES = 8 * 1024 * 1024;

export function BannerUploadSettings() {
  const { user, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  if (!user) return null;

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BANNER_BYTES) {
      setError('Channel banner must be 8MB or smaller.');
      setOk('');
      return;
    }
    setError('');
    setOk('');
    setPending(true);
    try {
      const contentType = file.type || 'image/jpeg';
      const { data } = await api.post<{
        data: { uploadUrl: string; publicUrl: string; key: string };
      }>(`/users/${user.id}/banner-upload-url`, {
        contentType,
        fileSizeBytes: file.size,
      });
      const { uploadUrl, publicUrl, key } = data.data;
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!put.ok) throw new Error('upload failed');
      await api.post(`/users/${user.id}/banner-upload-complete`, { key });
      const next = { ...user, bannerUrl: publicUrl };
      localStorage.setItem('forge_user', JSON.stringify(next));
      refresh();
      setOk('Channel banner updated.');
    } catch {
      setError('Could not upload banner. Use JPEG, PNG, or WebP (recommended ~2048×1152).');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-on-surface">Channel banner</p>
      <p className="text-xs text-on-surface-variant">
        Shown atop your public channel. JPEG, PNG, or WebP.
      </p>
      <div className="relative mt-3 aspect-[6/1] max-h-36 w-full overflow-hidden rounded-xl bg-surface-container-high">
        {user.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-outline">
            No banner yet
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        className="mt-2"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? 'Uploading…' : user.bannerUrl ? 'Change banner' : 'Upload banner'}
      </Button>
      {ok ? <p className="mt-1 text-xs text-secondary">{ok}</p> : null}
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </div>
  );
}
