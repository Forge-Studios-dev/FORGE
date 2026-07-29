'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken, persistAuthSession } from '@/lib/auth-storage';
import { User } from '@/types';

const STEPS = [
  { id: 1, label: 'Intent' },
  { id: 2, label: 'Focus' },
  { id: 3, label: 'Submit' },
] as const;

const FOCUS_OPTIONS = [
  'Video lessons & tutorials',
  'Live teaching sessions',
  'Courses & mentorship',
  'Community-led learning',
] as const;

export default function BecomeCreatorPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState('');
  const [focus, setFocus] = useState<string>(FOCUS_OPTIONS[0]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!agreed) {
      setError('Confirm you understand creator guidelines before submitting.');
      return;
    }
    setLoading(true);
    try {
      const payloadBio = [
        bio.trim(),
        focus ? `Primary focus: ${focus}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      const { data } = await api.post<{ data: User }>('/users/me/request-creator', {
        bio: payloadBio,
      });
      const access = getAccessToken();
      if (access) {
        persistAuthSession(access, undefined, JSON.stringify(data.data));
      } else if (user) {
        localStorage.setItem('forge_user', JSON.stringify(data.data));
      }
      refresh();
      router.push('/waiting-approval');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(message || 'Could not submit application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-16 md:px-12">
      <PageHeader
        title="Become a creator"
        subtitle="Share your expertise through tutorials and live teaching"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((item) => (
          <StatusPill
            key={item.id}
            tone={step === item.id ? 'primary' : step > item.id ? 'success' : 'neutral'}
            label={`${item.id}. ${item.label}`}
          />
        ))}
      </div>

      <div className="glass-panel space-y-5 rounded-2xl p-8">
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {step === 1 ? (
          <>
            <div>
              <label className="font-label-caps mb-2 block text-outline">
                Why do you want to teach on FORGE?
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                rows={5}
                className="w-full rounded-lg border border-subtle bg-surface-container-low px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none"
                placeholder="Describe your skills and what you'll teach…"
              />
            </div>
            <Button
              type="button"
              disabled={bio.trim().length < 20}
              className="w-full"
              onClick={() => {
                setError('');
                setStep(2);
              }}
            >
              Continue
            </Button>
            <p className="text-xs text-on-surface-variant">Minimum 20 characters.</p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <p className="font-label-caps mb-3 block text-outline">Primary teaching focus</p>
              <div className="space-y-2">
                {FOCUS_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      focus === option
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="focus"
                      checked={focus === option}
                      onChange={() => setFocus(option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" className="flex-1" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface">Review</p>
              <p className="mt-2 whitespace-pre-wrap">{bio.trim()}</p>
              <p className="mt-3">Focus: {focus}</p>
            </div>
            <label className="flex items-start gap-3 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              I understand creator applications are reviewed for skill quality, safety, and community fit.
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={loading || !agreed}
                className="flex-1"
                onClick={() => void handleSubmit()}
              >
                {loading ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </>
        ) : null}

        <p className="text-center text-sm text-on-surface-variant">
          Already applied?{' '}
          <Link href="/waiting-approval" className="text-primary hover:underline">
            Check status
          </Link>
        </p>
      </div>
    </main>
  );
}
