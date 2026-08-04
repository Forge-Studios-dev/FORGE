'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon, PageHeader } from '@forge/design-system';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { useAuth } from '@/lib/auth';
import {
  clearUploadDraft,
  getUploadDraft,
  saveUploadDraft,
  type UploadVideoType,
} from '@/lib/upload-draft';
import { api } from '@/lib/api';
import { clearUploadFile, getUploadFile, setUploadFile } from '@/lib/upload-file-store';
import {
  clearUploadThumbnail,
  getUploadThumbnail,
  setUploadThumbnail,
} from '@/lib/upload-thumbnail-store';
import { getStudioVideos } from '@/lib/creator-studio';
import { fetchUploadOptions, type UploadCategoryOption } from '@/lib/categories';
import { uploadVideo, validateUploadFile, type UploadPhase } from '@/lib/upload-video';
import { trackEvent } from '@/lib/analytics';

const TOTAL = 3;

const PHASE_LABEL: Record<UploadPhase, string> = {
  presigning: 'Preparing upload…',
  uploading: 'Uploading to storage…',
  completing: 'Finalizing video…',
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function UploadStepContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = Math.min(TOTAL, Math.max(1, Number(params.step) || 1));
  const { canUpload, accessTier, canApplyForCreator, user } = useAuth();

  const [draft, setDraft] = useState(getUploadDraft);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('presigning');
  const [error, setError] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const needsEmailVerification =
    user?.role === 'creator' && user?.creatorStatus === 'approved' && !user?.isVerified;

  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'short') {
      saveUploadDraft({ videoType: 'short' });
    }
    setDraft(getUploadDraft());
    const stored = getUploadFile();
    if (stored) setFile(stored);
    const storedThumb = getUploadThumbnail();
    if (storedThumb) {
      setThumbnail(storedThumb);
      setThumbnailPreview(URL.createObjectURL(storedThumb));
    }
  }, [step, searchParams]);

  const minScheduleLocal = useMemo(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  const { data: uploadOptions } = useQuery({
    queryKey: ['upload-options'],
    queryFn: fetchUploadOptions,
    enabled: canUpload,
    staleTime: 60_000,
  });

  const selectedCategory = uploadOptions?.find((c) => c.id === draft.categoryId);
  const availableSkills = selectedCategory?.skillTags ?? [];

  const { data: myPlaylists } = useQuery({
    queryKey: ['my-playlists'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: string; title: string }[] }>('/playlists/me');
      return data.data ?? [];
    },
    enabled: step === 3 && canUpload,
  });

  const { data: studioVideos } = useQuery({
    queryKey: ['studio-videos'],
    queryFn: getStudioVideos,
    enabled: canUpload && !!user?.id,
  });

  const inProgressUploads =
    studioVideos?.filter((v) => v.status === 'uploading' || v.status === 'processing') ?? [];

  if (needsEmailVerification) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 md:px-12">
        <NoAccessCallout
          title="Verify your email to upload"
          description="Your creator application is approved. Confirm your email address before publishing videos."
        />
        <Link href="/verify-email" className="mt-4 inline-block text-primary hover:underline">
          Resend verification email
        </Link>
        <Link href="/profile/settings" className="mt-2 block text-sm text-on-surface-variant hover:underline">
          Account settings
        </Link>
      </main>
    );
  }

  if (!canUpload) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 md:px-12">
        <NoAccessCallout
          title="Upload unavailable"
          description={
            accessTier === 'creator_pending'
              ? 'Your creator application is still under review — like YouTube Partner Program approval.'
              : 'Approved creators can upload videos. Viewers can watch, like, and subscribe without uploading.'
          }
        />
        {canApplyForCreator ? (
          <Link href="/upload/become-creator" className="mt-4 inline-block text-primary hover:underline">
            Apply to become a creator
          </Link>
        ) : accessTier === 'creator_pending' ? (
          <Link href="/waiting-approval" className="mt-4 inline-block text-primary hover:underline">
            View application status
          </Link>
        ) : null}
      </main>
    );
  }

  const persist = (patch: Partial<ReturnType<typeof getUploadDraft>>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveUploadDraft(next);
  };

  const selectFile = (f: File | null) => {
    setFile(f);
    setUploadFile(f);
    if (f) {
      const validation = validateUploadFile(f);
      if (validation) setError(validation);
      else setError('');
      persist({ fileName: f.name, fileSize: f.size, fileType: f.type });
    }
  };

  const metadataComplete =
    draft.title.trim().length >= 3 && !!draft.categoryId;

  const canContinueStep1 = metadataComplete;
  const canContinueStep2 = !!file && !validateUploadFile(file);

  const scheduleInvalid =
    draft.publishMode === 'scheduled' &&
    (!draft.scheduledAt || new Date(draft.scheduledAt).getTime() <= Date.now() + 14 * 60 * 1000);

  const canPublish =
    metadataComplete && !!file && !validateUploadFile(file) && !scheduleInvalid;

  const goNext = () => {
    if (step === 2 && file) setUploadFile(file);
    router.push(`/upload/step/${step + 1}`);
  };

  const handlePublish = async () => {
    const activeFile = file ?? getUploadFile();
    if (!activeFile) {
      setError('Select a video file on step 2 (or re-select below).');
      return;
    }
    const validation = validateUploadFile(activeFile);
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setUploading(true);
    setProgress(0);
    setPhase('presigning');
    try {
      const scheduledPublishAt =
        draft.publishMode === 'scheduled' && draft.scheduledAt
          ? new Date(draft.scheduledAt).toISOString()
          : undefined;

      const videoId = await uploadVideo(
        activeFile,
        draft.title,
        draft.description,
        (pct, p) => {
          setPhase(p);
          setProgress(p === 'uploading' ? pct : p === 'completing' ? 100 : 0);
        },
        {
          categoryId: draft.categoryId,
          skillTagIds: draft.skillTagIds,
          visibility: draft.visibility,
          scheduledPublishAt,
          playlistIds: draft.playlistIds,
          videoType: draft.videoType,
        },
      );
      void trackEvent(
        'studio.publish',
        { visibility: draft.visibility, scheduled: !!scheduledPublishAt },
        videoId,
      );
      clearUploadDraft();
      clearUploadFile();
      clearUploadThumbnail();
      router.push('/upload/success');
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as { message?: string })?.message ||
        'Upload failed';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader
        title={draft.videoType === 'short' ? 'Create a Short' : 'Upload a video'}
        subtitle={
          step === 1
            ? draft.videoType === 'short'
              ? 'Shorts work best under 60 seconds — add title, category, and tags'
              : 'Add title, category, tags, and an optional thumbnail'
            : step === 2
              ? draft.videoType === 'short'
                ? 'Upload a vertical clip (MP4 or MOV)'
                : 'Upload your video file'
              : 'Review visibility and publish'
        }
      />

      <nav aria-label="Upload steps" className="mb-6 flex flex-wrap gap-2">
        {[
          { n: 1, label: 'Details' },
          { n: 2, label: 'Upload' },
          { n: 3, label: 'Publish' },
        ].map((item) => {
          const active = step === item.n;
          const done = step > item.n;
          return (
            <div
              key={item.n}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                active
                  ? 'border-primary/40 bg-primary/10 text-on-surface'
                  : done
                    ? 'border-outline-variant/40 text-on-surface-variant'
                    : 'border-outline-variant/20 text-outline'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  active || done ? 'bg-primary/20 text-primary' : 'bg-surface-container-high'
                }`}
              >
                {done ? '✓' : item.n}
              </span>
              {item.label}
            </div>
          );
        })}
      </nav>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      {inProgressUploads.length > 0 ? (
        <div className="mb-4 rounded-lg border border-tertiary/30 bg-tertiary/5 px-4 py-3 text-sm">
          <p className="font-medium text-on-surface">
            {inProgressUploads.length} upload{inProgressUploads.length === 1 ? '' : 's'} still in progress
          </p>
          <p className="mt-1 text-on-surface-variant">
            Cancel them in Studio before starting a new upload, or use Clear stuck uploads there.
          </p>
          <Link href="/studio/videos" className="mt-2 inline-block font-semibold text-primary hover:underline">
            Open Studio → Videos
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
          {error}
          {error.includes('upload is still in progress') ? (
            <Link href="/studio/videos" className="mt-2 block font-semibold text-primary hover:underline">
              Manage in-progress uploads
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="glass-panel space-y-4 rounded-2xl p-6">
        {step === 1 && (
          <>
            <fieldset>
              <legend className="font-label-caps text-outline">Type</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { value: 'video' as UploadVideoType, label: 'Video', hint: 'Long-form' },
                    { value: 'short' as UploadVideoType, label: 'Short', hint: '≤ 60s' },
                  ] as const
                ).map((opt) => {
                  const active = draft.videoType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => persist({ videoType: opt.value })}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? 'border-primary bg-primary/15 text-on-surface'
                          : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant'
                      }`}
                      aria-pressed={active}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-outline">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="font-label-caps text-outline">Title</span>
              <input
                className="mt-1 w-full border-b border-outline-variant bg-transparent py-2 outline-none focus:border-primary"
                placeholder={
                  draft.videoType === 'short' ? 'e.g. 30-second tip' : 'e.g. My first vlog'
                }
                value={draft.title}
                onChange={(e) => persist({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="font-label-caps text-outline">Description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
                placeholder="Tell viewers about your video"
                rows={3}
                value={draft.description}
                onChange={(e) => persist({ description: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="font-label-caps text-outline">
                Category <span className="text-error">*</span>
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
                value={draft.categoryId}
                onChange={(e) =>
                  persist({ categoryId: e.target.value, skillTagIds: [] })
                }
              >
                <option value="">Select a category</option>
                {(uploadOptions ?? []).map((cat: UploadCategoryOption) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="block" disabled={!draft.categoryId}>
              <legend className="font-label-caps text-outline">
                Tags <span className="text-error">*</span>
              </legend>
              <p className="mt-1 text-xs text-on-surface-variant">
                Optional topic tags help viewers find this video.
              </p>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-outline-variant p-3">
                {availableSkills.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Choose a category first.</p>
                ) : (
                  availableSkills.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.skillTagIds.includes(tag.id)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...draft.skillTagIds, tag.id]
                            : draft.skillTagIds.filter((id) => id !== tag.id);
                          persist({ skillTagIds: ids });
                        }}
                      />
                      {escapeHtml(tag.name)}
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <label className="block">
              <span className="font-label-caps text-outline">Thumbnail</span>
              <p className="mt-1 text-xs text-on-surface-variant">
                Optional custom cover image. If omitted, a frame is captured automatically when processing finishes.
              </p>
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant hover:border-primary">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setThumbnail(f);
                    setUploadThumbnail(f);
                    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
                    setThumbnailPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
                {thumbnailPreview ? (
                  // next/image can't optimize blob: object URLs (local file preview, never fetched over the network)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="max-h-32 rounded-lg object-cover"
                  />
                ) : (
                  <span>Upload JPG, PNG, or WebP (optional)</span>
                )}
              </label>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <span className="block font-label-caps text-outline">Video file</span>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-12 text-center text-on-surface-variant hover:border-primary">
              <input
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
              {file || draft.fileName ? (
                <span className="text-on-surface">
                  {file?.name ?? draft.fileName}
                  {file ? ` · ${(file.size / (1024 * 1024)).toFixed(1)} MB` : null}
                </span>
              ) : (
                <>
                  <Icon name="cloud_upload" className="mb-2 text-4xl text-primary" />
                  <span className="font-medium text-on-surface">Drag video here or click to browse</span>
                  <span className="mt-1 text-sm">MP4 / MOV · resumable upload</span>
                </>
              )}
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-on-surface-variant">Review your video and publish.</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-outline">Title</dt>
                <dd>{draft.title}</dd>
              </div>
              {draft.description ? (
                <div>
                  <dt className="text-outline">Description</dt>
                  <dd>{draft.description}</dd>
                </div>
              ) : null}
              {selectedCategory ? (
                <div>
                  <dt className="text-outline">Category</dt>
                  <dd>{selectedCategory.name}</dd>
                </div>
              ) : null}
              {draft.skillTagIds.length > 0 ? (
                <div>
                  <dt className="text-outline">Tags</dt>
                  <dd>
                    {availableSkills
                      .filter((t) => draft.skillTagIds.includes(t.id))
                      .map((t) => t.name)
                      .join(', ')}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-outline">Thumbnail</dt>
                <dd>{thumbnail ? thumbnail.name : 'Auto-generated from video'}</dd>
              </div>
              <div>
                <dt className="text-outline">File</dt>
                <dd>
                  {file?.name ?? draft.fileName ?? '—'}
                  {file ? ` (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : null}
                </dd>
              </div>
            </dl>

            <fieldset className="space-y-3">
              <legend className="font-label-caps text-outline">Publish</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="publishMode"
                  checked={draft.publishMode === 'immediate'}
                  onChange={() => persist({ publishMode: 'immediate' })}
                />
                Publish immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="publishMode"
                  checked={draft.publishMode === 'scheduled'}
                  onChange={() => persist({ publishMode: 'scheduled' })}
                />
                Schedule for later
              </label>
              {draft.publishMode === 'scheduled' ? (
                <input
                  type="datetime-local"
                  min={minScheduleLocal}
                  value={draft.scheduledAt}
                  onChange={(e) => persist({ scheduledAt: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                />
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-label-caps text-outline">Visibility</legend>
              {(
                [
                  { value: 'public', label: 'Public', hint: 'Everyone' },
                  { value: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link' },
                  { value: 'private', label: 'Private', hint: 'Only you' },
                ] as const
              ).map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    className="mt-1"
                    checked={draft.visibility === opt.value}
                    onChange={() => persist({ visibility: opt.value })}
                  />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-xs text-on-surface-variant">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {myPlaylists && myPlaylists.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="font-label-caps text-outline">Add to playlist (optional)</legend>
                {myPlaylists.map((pl) => (
                  <label key={pl.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.playlistIds.includes(pl.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...draft.playlistIds, pl.id]
                          : draft.playlistIds.filter((id) => id !== pl.id);
                        persist({ playlistIds: ids });
                      }}
                    />
                    {pl.title}
                  </label>
                ))}
              </fieldset>
            ) : null}

            {!file && draft.fileName ? (
              <div className="rounded-lg border border-tertiary/30 bg-tertiary/5 p-4">
                <p className="text-sm text-on-surface-variant">
                  Video file was lost after changing steps. Re-select your file to publish.
                </p>
                <label className="mt-3 inline-block cursor-pointer text-sm font-semibold text-primary hover:underline">
                  Re-select video
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,.mp4,.mov"
                    className="hidden"
                    onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            ) : null}

            {uploading ? (
              <div className="pt-2">
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${phase === 'uploading' ? progress : phase === 'completing' ? 100 : 12}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-outline">
                  {PHASE_LABEL[phase]}
                  {phase === 'uploading' ? ` ${progress}%` : ''}
                </p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  You can open{' '}
                  <Link href="/studio/videos" className="font-semibold text-primary hover:underline">
                    Studio → Videos
                  </Link>{' '}
                  while this runs — upload continues in the background.
                </p>
              </div>
            ) : null}
          </>
        )}

        <div className="flex gap-3 pt-4">
          {step > 1 && !uploading && (
            <Link
              href={`/upload/step/${step - 1}`}
              className="rounded-full border border-outline-variant px-6 py-2 text-sm"
            >
              Back
            </Link>
          )}
          {step < TOTAL ? (
            <button
              type="button"
              disabled={
                (step === 1 && !canContinueStep1) ||
                (step === 2 && !canContinueStep2)
              }
              title={
                step === 1 && !metadataComplete
                  ? 'Title and category are required'
                  : undefined
              }
              onClick={goNext}
              className="primary-button ml-auto rounded-full px-8 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={uploading || !canPublish}
              onClick={() => void handlePublish()}
              className="primary-button ml-auto rounded-full px-8 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
            >
              {uploading ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function UploadStepPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
          <p className="text-on-surface-variant">Loading upload…</p>
        </main>
      }
    >
      <UploadStepContent />
    </Suspense>
  );
}
