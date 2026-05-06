'use client';

import { useState } from 'react';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { getStoredUser, hasPermission } from '@/lib/permissions';
import { api } from '@/lib/api';

type UploadStep = 'idle' | 'presigning' | 'uploading' | 'completing' | 'done' | 'error';

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime']);

export default function UploadPage() {
  const user = getStoredUser();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<UploadStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [createdVideoId, setCreatedVideoId] = useState<string | null>(null);

  if (!hasPermission(user, 'UPLOAD_VIDEO')) {
    return (
      <main className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <NoAccessCallout
            title="Upload unavailable"
            description="You need creator approval to upload videos. Request creator access from your profile, then wait for approval."
          />
        </div>
      </main>
    );
  }

  const canSubmit =
    !!file &&
    title.trim().length >= 3 &&
    ALLOWED_TYPES.has(file.type) &&
    file.size <= MAX_BYTES &&
    step !== 'presigning' &&
    step !== 'uploading' &&
    step !== 'completing';

  async function uploadViaPresignedUrl(uploadUrl: string, fileToUpload: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', fileToUpload.type);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(fileToUpload);
    });
  }

  async function handleUpload() {
    if (!file) return;
    setError('');
    setProgress(0);
    setCreatedVideoId(null);

    try {
      setStep('presigning');
      const presignRes = await api.post('/videos/presigned-url', {
        contentType: file.type,
        fileSizeBytes: file.size,
      });
      const { videoId, uploadUrl } = presignRes.data.data as {
        videoId: string;
        uploadUrl: string;
      };

      setCreatedVideoId(videoId);

      setStep('uploading');
      await uploadViaPresignedUrl(uploadUrl, file);

      setStep('completing');
      await api.post(`/videos/${videoId}/complete`, {
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
      });

      setStep('done');
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as { message?: string })?.message ||
        'Upload failed';
      setError(message);
      setStep('error');
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold">Upload</h1>
        <p className="text-gray-400 mt-2">
          Direct-to-S3 upload (presigned URL) with processing kickoff on completion.
        </p>

        <div className="mt-8 glass rounded-2xl p-6 border border-white/10 space-y-5">
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Video file</label>
            <input
              type="file"
              accept="video/mp4,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/15"
            />
            {file ? (
              <p className="text-xs text-gray-500 mt-2">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB · {file.type}
              </p>
            ) : null}
            {file && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_BYTES) ? (
              <p className="text-xs text-red-400 mt-2">
                File must be MP4/MOV and ≤ 500MB.
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-forge-500 transition"
              placeholder="My new tutorial"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-24 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-forge-500 transition"
              placeholder="What’s this about?"
            />
          </div>

          <div className="space-y-2">
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-forge-600 transition-all"
                style={{ width: `${step === 'uploading' || step === 'completing' || step === 'done' ? progress : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {step === 'idle' && 'Ready to upload.'}
              {step === 'presigning' && 'Preparing upload…'}
              {step === 'uploading' && `Uploading… ${progress}%`}
              {step === 'completing' && 'Finalizing and starting processing…'}
              {step === 'done' && 'Upload complete. Processing started.'}
              {step === 'error' && 'Upload failed.'}
            </p>
            {createdVideoId ? (
              <p className="text-xs text-gray-500">Video ID: {createdVideoId}</p>
            ) : null}
          </div>

          <button
            onClick={handleUpload}
            disabled={!canSubmit}
            className="bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            {step === 'uploading' || step === 'presigning' || step === 'completing' ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </main>
  );
}

