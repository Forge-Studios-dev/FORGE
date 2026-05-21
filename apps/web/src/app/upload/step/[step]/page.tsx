'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@forge/design-system';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { useAuth } from '@/lib/auth';
import { clearUploadDraft, getUploadDraft, saveUploadDraft } from '@/lib/upload-draft';
import { clearUploadFile, getUploadFile, setUploadFile } from '@/lib/upload-file-store';
import { uploadLesson, validateUploadFile, type UploadPhase } from '@/lib/upload-lesson';

const TOTAL = 3;

const PHASE_LABEL: Record<UploadPhase, string> = {
  presigning: 'Preparing upload…',
  uploading: 'Uploading to storage…',
  completing: 'Finalizing lesson…',
};

export default function UploadStepPage() {
  const params = useParams();
  const router = useRouter();
  const step = Math.min(TOTAL, Math.max(1, Number(params.step) || 1));
  const { canUpload, accessTier, canApplyForCreator, user } = useAuth();

  const [draft, setDraft] = useState(getUploadDraft);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('presigning');
  const [error, setError] = useState('');

  const needsEmailVerification =
    user?.role === 'creator' && user?.creatorStatus === 'approved' && !user?.isVerified;

  useEffect(() => {
    setDraft(getUploadDraft());
    const stored = getUploadFile();
    if (stored) setFile(stored);
  }, [step]);

  if (needsEmailVerification) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 md:px-12">
        <NoAccessCallout
          title="Verify your email to upload"
          description="Your creator application is approved. Confirm your email address before publishing lessons."
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
              : 'Approved creators can upload lessons. Viewers can watch, like, and subscribe without uploading.'
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

  const canContinueStep1 = draft.title.trim().length >= 3;
  const canContinueStep2 = !!file && !validateUploadFile(file);
  const canPublish = !!file && !validateUploadFile(file);

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
      await uploadLesson(
        activeFile,
        draft.title,
        draft.description,
        (pct, p) => {
          setPhase(p);
          setProgress(p === 'uploading' ? pct : p === 'completing' ? 100 : 0);
        },
        draft.skillTag,
      );
      clearUploadDraft();
      clearUploadFile();
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
    <main className="mx-auto max-w-xl px-5 py-8 md:px-12">
      <PageHeader title={`Upload — Step ${step} of ${TOTAL}`} subtitle="Publish a new lesson" />
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / TOTAL) * 100}%` }}
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="glass-panel space-y-4 rounded-2xl p-6">
        {step === 1 && (
          <>
            <label className="block">
              <span className="font-label-caps text-outline">Lesson title</span>
              <input
                className="mt-1 w-full border-b border-outline-variant bg-transparent py-2 outline-none focus:border-primary"
                placeholder="e.g. Advanced React Patterns"
                value={draft.title}
                onChange={(e) => persist({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="font-label-caps text-outline">Description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
                placeholder="What will learners gain?"
                rows={3}
                value={draft.description}
                onChange={(e) => persist({ description: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="font-label-caps text-outline">Skill tag</span>
              <input
                className="mt-1 w-full border-b border-outline-variant bg-transparent py-2 outline-none focus:border-primary"
                placeholder="React.js"
                value={draft.skillTag}
                onChange={(e) => persist({ skillTag: e.target.value })}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <span className="block font-label-caps text-outline">Video file</span>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant p-12 text-center text-on-surface-variant hover:border-primary">
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
                <span>Drop video or click to browse (MP4/MOV, max 500MB)</span>
              )}
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-on-surface-variant">Review your lesson and publish.</p>
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
              {draft.skillTag ? (
                <div>
                  <dt className="text-outline">Skill</dt>
                  <dd>{draft.skillTag}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-outline">File</dt>
                <dd>
                  {file?.name ?? draft.fileName ?? '—'}
                  {file ? ` (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : null}
                </dd>
              </div>
            </dl>

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
              disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2)}
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
