'use client';

import { useEffect, useState } from 'react';
import { Icon, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminMfaSettings } from '@/components/AdminMfaSettings';
import { fetchAdminPlatformConfig } from '@/lib/platform-config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface HealthPayload {
  status: string;
  timestamp: string;
  checks?: Record<string, string>;
  correlationId?: string;
}

function docsHref(): string {
  try {
    const u = new URL(API_URL);
    u.pathname = '/api/docs';
    u.search = '';
    return u.toString();
  } catch {
    return '/api/docs';
  }
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [skillFeatures, setSkillFeatures] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    void fetchAdminPlatformConfig().then((cfg) => setSkillFeatures(cfg.skillFeatures ?? null));
  }, []);

  async function checkHealth() {
    setIsFetching(true);
    setIsError(false);
    try {
      const { data } = await api.get<{ data: HealthPayload }>('/health/ready');
      setHealth(data.data);
    } catch {
      setHealth(null);
      setIsError(true);
    } finally {
      setIsFetching(false);
    }
  }

  return (
    <section className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Environment and API connectivity for this admin build"
      />

      <div className="mt-8 space-y-6">
        <section className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="lock" className="text-primary" />
            <h2 className="font-display-forge text-lg font-semibold">Two-factor authentication</h2>
          </div>
          <AdminMfaSettings />
        </section>

        <section className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="dns" className="text-primary" />
            <h2 className="font-display-forge text-lg font-semibold">API</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-outline">Configured base URL</dt>
              <dd className="mt-1 break-all font-mono text-on-surface">{API_URL}</dd>
            </div>
            <div>
              <dt className="text-outline">API documentation</dt>
              <dd className="mt-1">
                <a
                  href={docsHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  Open Swagger
                  <Icon name="open_in_new" className="text-sm" />
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="monitor_heart" className="text-primary" />
              <h2 className="font-display-forge text-lg font-semibold">API health</h2>
            </div>
            <button
              type="button"
              onClick={() => void checkHealth()}
              disabled={isFetching}
              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs hover:border-primary disabled:opacity-50"
            >
              {isFetching ? 'Checking…' : 'Check health'}
            </button>
          </div>

          {!health && !isError && !isFetching && (
            <p className="text-sm text-on-surface-variant">
              On demand only — click Check health to call <code className="text-on-surface">/health/ready</code>.
            </p>
          )}
          {isFetching && <p className="text-sm text-on-surface-variant">Checking health…</p>}
          {isError && (
            <p className="text-sm text-tertiary">
              Could not reach the API. Confirm NEXT_PUBLIC_API_URL and that the API is running.
            </p>
          )}
          {health && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-outline">Status </span>
                <span className={health.status === 'ok' ? 'text-secondary' : 'text-tertiary'}>
                  {health.status}
                </span>
              </p>
              {health.correlationId && (
                <p className="break-all font-mono text-xs text-on-surface-variant">
                  {health.correlationId}
                </p>
              )}
              <ul className="grid gap-2 sm:grid-cols-2">
                {Object.entries(health.checks ?? {}).map(([key, value]) => (
                  <li
                    key={key}
                    className="flex justify-between gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2"
                  >
                    <span className="text-outline">{key}</span>
                    <span
                      className={
                        value === 'ok' || value === 'webhook'
                          ? 'text-secondary'
                          : value === 'noop'
                            ? 'text-on-surface-variant'
                            : 'text-tertiary'
                      }
                    >
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
              {health.checks?.contentScan === 'noop' ? (
                <p className="text-xs text-on-surface-variant">
                  Content scan is noop until <code className="text-on-surface">CONTENT_SCAN_PROVIDER=webhook</code>{' '}
                  and a vendor URL are configured (ops/legal).
                </p>
              ) : null}
              {health.checks?.contentScan === 'misconfigured' ? (
                <p className="text-xs text-tertiary" role="alert">
                  Webhook provider selected but CONTENT_SCAN_WEBHOOK_URL is empty.
                </p>
              ) : null}
              <p className="text-xs text-outline">Last check: {health.timestamp}</p>
            </div>
          )}
        </section>

        <section className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="school" className="text-primary" />
            <h2 className="font-display-forge text-lg font-semibold">Skill extensions</h2>
          </div>
          {skillFeatures ? (
            <ul className="space-y-2 text-sm">
              {(
                [
                  ['courses', 'Courses'],
                  ['mentorship', 'Mentorship'],
                  ['channelPoints', 'Channel points'],
                  ['skillEconomyLms', 'Full LMS (programs, cohorts, quizzes)'],
                ] as const
              ).map(([key, label]) => (
                <li key={key} className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className={skillFeatures[key] ? 'text-secondary' : 'text-outline'}>
                    {skillFeatures[key] ? 'On' : 'Off'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-on-surface-variant">Loading platform config…</p>
          )}
          <p className="mt-3 text-xs text-on-surface-variant">
            Set <code className="text-on-surface">FEATURES_*</code> in API env and restart. Validate
            with <code className="text-on-surface">npm run smoke:skill-features</code>.
          </p>
        </section>

        <section className="glass-panel rounded-xl p-6">
          <h2 className="font-display-forge mb-2 text-lg font-semibold">Go-live</h2>
          <p className="text-sm text-on-surface-variant">
            Complete the production checklist in{' '}
            <code className="text-on-surface">docs/operations/PRODUCTION_CHECKLIST.md</code> before
            promoting builds.
          </p>
        </section>
      </div>
    </section>
  );
}
