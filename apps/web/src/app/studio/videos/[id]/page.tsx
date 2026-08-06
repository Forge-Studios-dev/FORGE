'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Icon, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { fetchCategorySkillTags, fetchUploadOptions, type UploadCategoryOption, type UploadSkillTag } from '@/lib/categories';
import { studioPublicPath } from '@/lib/creator-studio';
import { DescriptionChaptersHint } from '@/components/studio/DescriptionChaptersHint';
import { SaveToPlaylistModal } from '@/components/playlists/SaveToPlaylistModal';
import { formatCount } from '@/lib/utils';
import type { UploadVisibility } from '@/lib/upload-draft';
import type { Video } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Published',
  failed: 'Failed',
  pending: 'Pending',
};

function statusTone(status: string): StatusTone {
  if (status === 'ready') return 'success';
  if (status === 'processing' || status === 'uploading') return 'warning';
  if (status === 'failed') return 'critical';
  return 'neutral';
}

export default function StudioVideoDetailEditorPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isCreator } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<UploadVisibility>('public');
  const [videoType, setVideoType] = useState<'video' | 'short'>('video');
  const [schedule, setSchedule] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<UploadCategoryOption[]>([]);
  const [availableTags, setAvailableTags] = useState<UploadSkillTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionMsg, setCaptionMsg] = useState('');
  const [captionLang, setCaptionLang] = useState('en');
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbMsg, setThumbMsg] = useState('');
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const CAPTION_LANG_OPTIONS = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'hi', label: 'Hindi' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'ar', label: 'Arabic' },
  ] as const;

  const { data: video, isLoading, isError } = useQuery({
    queryKey: ['studio-video', id],
    enabled: !!id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Video }>(`/videos/${id}`);
      return data.data;
    },
  });

  const { data: containingPlaylistIds = [] } = useQuery({
    queryKey: ['playlists', 'containing', id],
    enabled: !!id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: { playlistIds: string[] } }>(
        `/playlists/me/containing/${id}`,
      );
      return data.data.playlistIds ?? [];
    },
  });

  useEffect(() => {
    void fetchUploadOptions()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!video) return;
    setTitle(video.title ?? '');
    setDescription(video.description ?? '');
    setVisibility((video.visibility as UploadVisibility) ?? 'public');
    setVideoType(video.videoType === 'short' ? 'short' : 'video');
    setSchedule(
      video.scheduledPublishAt
        ? new Date(video.scheduledPublishAt).toISOString().slice(0, 16)
        : '',
    );
    setCategoryId(video.categoryId ?? '');
    setSelectedTagIds((video.skillTags ?? []).map((t) => t.id));
    if (video.categoryId) {
      setTagsLoading(true);
      void fetchCategorySkillTags(video.categoryId)
        .then(setAvailableTags)
        .catch(() => setAvailableTags([]))
        .finally(() => setTagsLoading(false));
    } else {
      setAvailableTags([]);
    }
  }, [video]);

  const loadTagsForCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setSelectedTagIds([]);
    if (!nextCategoryId) {
      setAvailableTags([]);
      return;
    }
    setTagsLoading(true);
    void fetchCategorySkillTags(nextCategoryId)
      .then(setAvailableTags)
      .catch(() => setAvailableTags([]))
      .finally(() => setTagsLoading(false));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/videos/${id}`, {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
        videoType,
        scheduledPublishAt: schedule ? new Date(schedule).toISOString() : null,
        ...(categoryId ? { categoryId, skillTagIds: selectedTagIds } : {}),
      });
    },
    onSuccess: async () => {
      setError('');
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not save video.')),
  });

  const publishNowMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/videos/${id}`, {
        title: title.trim() || video?.title,
        description: description.trim() || null,
        visibility,
        videoType,
        scheduledPublishAt: null,
        ...(categoryId ? { categoryId, skillTagIds: selectedTagIds } : {}),
      });
    },
    onSuccess: async () => {
      setSchedule('');
      setError('');
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not publish now.')),
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/videos/${id}`, {
        scheduledPublishAt: null,
        visibility: 'private',
      });
    },
    onSuccess: async () => {
      setSchedule('');
      setVisibility('private');
      setError('');
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not cancel schedule.')),
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/videos/${id}/retry-transcode`);
    },
    onSuccess: async () => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not retry processing.')),
  });

  async function uploadCaption(file: File) {
    if (!file.name.toLowerCase().endsWith('.vtt') && file.type !== 'text/vtt') {
      setCaptionMsg('Please choose a .vtt WebVTT file.');
      return;
    }
    setCaptionBusy(true);
    setCaptionMsg('');
    try {
      const { data } = await api.post<{
        data: { uploadUrl: string; publicUrl: string };
      }>(`/videos/${id}/caption/presigned-url`, {
        contentType: 'text/vtt',
        language: captionLang,
      });
      const { uploadUrl, publicUrl } = data.data;
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'text/vtt' },
      });
      if (!put.ok) {
        throw new Error(`Upload failed (${put.status})`);
      }
      await api.put(`/videos/${id}/caption`, {
        captionUrl: publicUrl,
        language: captionLang,
      });
      setCaptionMsg(`Captions uploaded (${captionLang}).`);
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
    } catch (e) {
      setCaptionMsg(getApiErrorMessage(e, 'Could not upload captions.'));
    } finally {
      setCaptionBusy(false);
    }
  }

  async function clearCaption(language?: string) {
    setCaptionBusy(true);
    setCaptionMsg('');
    try {
      await api.put(`/videos/${id}/caption`, {
        captionUrl: null,
        language: language ?? captionLang,
      });
      setCaptionMsg('Captions removed.');
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
    } catch (e) {
      setCaptionMsg(getApiErrorMessage(e, 'Could not remove captions.'));
    } finally {
      setCaptionBusy(false);
    }
  }

  async function uploadThumbnail(file: File) {
    const type =
      file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg'
        ? file.type
        : file.name.toLowerCase().endsWith('.png')
          ? 'image/png'
          : file.name.toLowerCase().endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      setThumbMsg('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    setThumbBusy(true);
    setThumbMsg('');
    try {
      const { data } = await api.post<{
        data: { uploadUrl: string; publicUrl: string };
      }>(`/videos/${id}/thumbnail/presigned-url`, { contentType: type });
      const { uploadUrl, publicUrl } = data.data;
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': type },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await api.put(`/videos/${id}/thumbnail`, { thumbnailUrl: publicUrl });
      setThumbMsg('Thumbnail updated.');
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
    } catch (e) {
      setThumbMsg(getApiErrorMessage(e, 'Could not upload thumbnail.'));
    } finally {
      setThumbBusy(false);
    }
  }

  async function clearThumbnail() {
    setThumbBusy(true);
    setThumbMsg('');
    try {
      await api.put(`/videos/${id}/thumbnail`, { thumbnailUrl: null });
      setThumbMsg('Custom thumbnail cleared.');
      await qc.invalidateQueries({ queryKey: ['studio-video', id] });
      await qc.invalidateQueries({ queryKey: ['studio-videos'] });
    } catch (e) {
      setThumbMsg(getApiErrorMessage(e, 'Could not clear thumbnail.'));
    } finally {
      setThumbBusy(false);
    }
  }

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Loading video editor…</p>
      </main>
    );
  }

  if (isError || !video || (user && video.userId !== user.id)) {
    return (
      <main className="space-y-4">
        <PageHeader title="Video editor" subtitle="This video could not be loaded." />
        <Link href="/studio/videos" className="text-sm text-primary hover:underline">
          Back to videos
        </Link>
      </main>
    );
  }

  const canEditTags = !!categoryId;
  const hasFutureSchedule =
    !!schedule ||
    (!!video.scheduledPublishAt && new Date(video.scheduledPublishAt).getTime() > Date.now());

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Video detail editor"
          subtitle="Update title, visibility, category, schedule, and tags for this video."
        />
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/studio/videos" className="text-primary hover:underline">
            Back to library
          </Link>
          {video.status === 'ready' ? (
            <Link
              href={studioPublicPath(video)}
              className="text-on-surface-variant hover:underline"
            >
              View public page
            </Link>
          ) : null}
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
        <div className="glass-panel space-y-5 rounded-2xl p-6">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          {saved ? <p className="text-sm text-secondary">Saved.</p> : null}

          <label className="block text-sm">
            <span className="text-on-surface-variant">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            />
          </label>

          <label className="block text-sm">
            <span className="text-on-surface-variant">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={'Tell viewers about your video. Optional chapters:\n0:00 Intro\n1:30 Main topic\n5:00 Outro'}
              className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            />
            <DescriptionChaptersHint description={description} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-on-surface-variant">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as UploadVisibility)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
              >
                <option value="public">Public — Everyone</option>
                <option value="unlisted">Unlisted — Anyone with the link</option>
                <option value="private">Private — Only you</option>
                <option value="followers">Subscribers — Channel subscribers</option>
                <option value="subscribers">Members — Channel membership</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-on-surface-variant">Type</span>
              <select
                value={videoType}
                onChange={(e) => setVideoType(e.target.value as 'video' | 'short')}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
              >
                <option value="video">Video</option>
                <option value="short">Short</option>
              </select>
              {video.durationSeconds != null && video.durationSeconds > 60 && videoType === 'short' ? (
                <p className="mt-1 text-xs text-error">
                  Shorts must be 60 seconds or shorter ({Math.round(video.durationSeconds)}s).
                </p>
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Shorts appear in the Shorts shelf and feed.
                </p>
              )}
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-on-surface-variant">Schedule publish</span>
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
              />
            </label>
          </div>
          {hasFutureSchedule ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-on-surface-variant">
                This video is scheduled
                {video.scheduledPublishAt
                  ? ` for ${new Date(video.scheduledPublishAt).toLocaleString()}`
                  : ''}
                .
              </p>
              <button
                type="button"
                disabled={
                  publishNowMutation.isPending ||
                  cancelScheduleMutation.isPending ||
                  saveMutation.isPending
                }
                onClick={() => publishNowMutation.mutate()}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-primary/15 disabled:opacity-50"
              >
                {publishNowMutation.isPending ? 'Publishing…' : 'Publish now'}
              </button>
              <button
                type="button"
                disabled={
                  publishNowMutation.isPending ||
                  cancelScheduleMutation.isPending ||
                  saveMutation.isPending
                }
                onClick={() => cancelScheduleMutation.mutate()}
                className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              >
                {cancelScheduleMutation.isPending ? 'Cancelling…' : 'Cancel schedule'}
              </button>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-outline-variant/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-label-caps text-xs text-outline">Playlists</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {containingPlaylistIds.length > 0
                    ? `In ${containingPlaylistIds.length} playlist${containingPlaylistIds.length === 1 ? '' : 's'}`
                    : 'Not in any playlist yet'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaylistOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary"
              >
                <Icon name="playlist_add" />
                Manage playlists
              </button>
            </div>
            <Link href="/studio/playlists" className="text-xs text-primary hover:underline">
              Open playlist manager
            </Link>
          </div>

          {canEditTags ? (
            <div className="space-y-3">
              <label className="block text-sm text-on-surface-variant">
                Category
                <select
                  value={categoryId}
                  onChange={(e) => loadTagsForCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 text-sm"
                >
                  {categories.length === 0 ? (
                    <option value={categoryId}>Current category</option>
                  ) : null}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-2 text-sm text-on-surface-variant">Topic tags</p>
                {tagsLoading ? (
                  <p className="text-sm text-on-surface-variant">Loading tags…</p>
                ) : availableTags.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No tags for this category.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const active = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((t) => t !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            active
                              ? 'border-primary bg-primary/15 text-on-surface'
                              : 'border-outline-variant/40 text-on-surface-variant'
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : categories.length > 0 ? (
            <label className="block text-sm text-on-surface-variant">
              Category
              <select
                value=""
                onChange={(e) => loadTagsForCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 text-sm"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {(video.status === 'ready' || video.status === 'processing') && (
            <div className="space-y-3 rounded-xl border border-outline-variant/30 p-4">
              <div>
                <p className="font-label-caps text-xs text-outline">Captions</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Upload WebVTT (`.vtt`) files per language. Viewers pick a track in the player.
                </p>
              </div>
              {(video.captionTracks?.length ?? 0) > 0 ? (
                <ul className="space-y-1 text-xs text-secondary">
                  {video.captionTracks!.map((t) => (
                    <li key={t.language} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.label}</span>
                      <span className="truncate text-on-surface-variant" title={t.url}>
                        ({t.language})
                      </span>
                      <button
                        type="button"
                        disabled={captionBusy}
                        onClick={() => void clearCaption(t.language)}
                        className="text-error hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : video.captionUrl ? (
                <p className="truncate text-xs text-secondary" title={video.captionUrl}>
                  Current: {video.captionUrl}
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant">No caption files attached yet.</p>
              )}
              <label className="block text-sm">
                <span className="text-on-surface-variant">Language</span>
                <select
                  value={captionLang}
                  onChange={(e) => setCaptionLang(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                >
                  {CAPTION_LANG_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary">
                  <Icon name="subtitles" />
                  {captionBusy ? 'Uploading…' : `Upload ${captionLang}.vtt`}
                  <input
                    type="file"
                    accept=".vtt,text/vtt"
                    className="sr-only"
                    disabled={captionBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadCaption(file);
                    }}
                  />
                </label>
              </div>
              {captionMsg ? (
                <p className="text-sm text-secondary" role="status">
                  {captionMsg}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saveMutation.isPending || title.trim().length < 1}
              onClick={() => saveMutation.mutate()}
              className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              <Icon name="save" />
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/studio/videos')}
              className="rounded-full border border-outline-variant/40 px-5 py-2.5 text-sm hover:border-primary"
            >
              Cancel
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="relative aspect-video bg-surface-container-high">
              {video.thumbnailUrl ? (
                <Image src={video.thumbnailUrl} alt="" fill className="object-cover" sizes="400px" />
              ) : (
                <div className="flex h-full items-center justify-center text-outline">
                  <Icon name="movie" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <StatusPill
                tone={statusTone(video.status)}
                label={STATUS_LABEL[video.status] ?? video.status}
              />
              <p className="text-sm text-on-surface-variant">
                {formatCount(video.viewCount)} views · {formatCount(video.likeCount)} likes ·{' '}
                {formatCount(video.commentCount)} comments
              </p>
              {(video.status === 'ready' ||
                video.status === 'processing' ||
                video.status === 'uploading') && (
                <div className="space-y-2 border-t border-outline-variant/30 pt-3">
                  <p className="font-label-caps text-xs text-outline">Thumbnail</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary">
                      {thumbBusy ? 'Uploading…' : 'Change thumbnail'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        disabled={thumbBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadThumbnail(file);
                        }}
                      />
                    </label>
                    {video.thumbnailUrl ? (
                      <button
                        type="button"
                        disabled={thumbBusy}
                        onClick={() => void clearThumbnail()}
                        className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {thumbMsg ? <p className="text-xs text-on-surface-variant">{thumbMsg}</p> : null}
                </div>
              )}
              {video.sourceStreamId ? (
                <Link
                  href={`/studio/live/${video.sourceStreamId}/debrief`}
                  className="inline-flex text-sm text-primary hover:underline"
                >
                  Open source stream debrief
                </Link>
              ) : null}
              {(video.status === 'processing' ||
                video.status === 'uploading' ||
                video.status === 'failed' ||
                video.status === 'pending') && (
                <div className="space-y-3 border-t border-outline-variant/30 pt-3">
                  <p className="font-label-caps text-xs text-outline">Processing detail</p>
                  <p className="text-sm text-on-surface-variant">
                    {video.status === 'uploading'
                      ? 'File is still uploading to storage.'
                      : video.status === 'processing' || video.status === 'pending'
                        ? `Transcoding${video.transcodeProvider ? ` via ${video.transcodeProvider}` : ''} is in progress. This usually finishes within a few minutes.`
                        : video.failureReason ??
                          'Processing failed. You can retry transcoding or cancel and re-upload.'}
                  </p>
                  {video.status === 'failed' ? (
                    <button
                      type="button"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate()}
                      className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
                    >
                      {retryMutation.isPending ? 'Retrying…' : 'Retry transcode'}
                    </button>
                  ) : null}
                  <Link
                    href="/studio/upload-reliability"
                    className="inline-flex text-sm text-on-surface-variant hover:underline"
                  >
                    Upload reliability tips
                  </Link>
                </div>
              )}
              {video.status === 'ready' ? (
                <p className="text-sm text-secondary">Published and ready to watch.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <SaveToPlaylistModal
        videoId={id}
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
      />
    </main>
  );
}
