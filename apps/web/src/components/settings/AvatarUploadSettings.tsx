'use client';

import { useRef, useState } from 'react';
import { Avatar, Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Presign → PUT → refresh user with new avatarUrl (API writes URL before upload completes). */
export function AvatarUploadSettings() {
  const { user, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  if (!user) return null;

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError('');
    setOk('');
    setPending(true);
    try {
      const contentType = file.type || 'image/jpeg';
      const { data } = await api.post<{
        data: { uploadUrl: string; publicUrl: string };
      }>(`/users/${user.id}/avatar-upload-url?contentType=${encodeURIComponent(contentType)}`);
      const { uploadUrl, publicUrl } = data.data;
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!put.ok) throw new Error('upload failed');
      const next = { ...user, avatarUrl: publicUrl };
      localStorage.setItem('forge_user', JSON.stringify(next));
      refresh();
      setOk('Profile photo updated.');
    } catch {
      setError('Could not upload photo. Use JPEG, PNG, or WebP under a few MB.');
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-6 flex items-center gap-4">
      <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-on-surface">Profile photo</p>
        <p className="text-xs text-on-surface-variant">JPEG, PNG, or WebP</p>
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
          {pending ? 'Uploading…' : 'Change photo'}
        </Button>
        {ok ? <p className="mt-1 text-xs text-secondary">{ok}</p> : null}
        {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
      </div>
    </div>
  );
}
