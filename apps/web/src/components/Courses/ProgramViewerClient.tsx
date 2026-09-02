'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export type ProgramCourseItem = {
  id: string;
  courseId: string;
  course?: { id: string; title: string; slug: string; isPublished: boolean } | null;
};

export type PublicProgram = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isFree: boolean;
  priceCents: number;
  hasPurchased?: boolean;
  courses: ProgramCourseItem[];
};

export function ProgramViewerClient({
  program,
  creatorUsername,
  justPurchased = false,
}: {
  program: PublicProgram;
  creatorUsername: string;
  justPurchased?: boolean;
}) {
  const { isGuest } = useAuth();
  const programPath = `/${creatorUsername}/programs/${program.slug}`;
  const ownsProgram = program.hasPurchased || justPurchased;

  const enrollMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/programs/${program.id}/enroll`, {});
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data } = await api.post<{
        data: { checkoutUrl?: string | null; requiresCheckout?: boolean };
      }>(`/programs/${program.id}/checkout`, {
        successUrl: `${origin}${programPath}?purchased=1`,
        cancelUrl: `${origin}${programPath}`,
      });
      return data.data;
    },
    onSuccess: (payload) => {
      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
      }
    },
  });

  const confirmPurchaseEnroll = enrollMutation.mutate;
  useEffect(() => {
    if (!justPurchased || isGuest || program.isFree) return;
    confirmPurchaseEnroll();
  }, [justPurchased, isGuest, program.isFree, confirmPurchaseEnroll]);

  const priceLabel =
    program.priceCents > 0 ? `$${(program.priceCents / 100).toFixed(2)}` : null;

  return (
    <>
      {justPurchased && !isGuest ? (
        <div
          className="mb-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-on-surface"
          role="status"
        >
          {enrollMutation.isSuccess || program.hasPurchased
            ? 'Purchase complete — you are enrolled in all program courses.'
            : enrollMutation.isPending
              ? 'Confirming your purchase…'
              : enrollMutation.isError
                ? 'Payment received — courses unlock shortly. Refresh if access is missing.'
                : 'Purchase complete — unlocking courses…'}
        </div>
      ) : null}

      {program.description ? (
        <p className="mb-6 text-sm text-on-surface-variant">{program.description}</p>
      ) : null}

      {program.isFree ? (
        isGuest ? (
          <p className="mb-6 text-sm text-on-surface-variant">
            <Link href={`/login?next=${programPath}`} className="text-primary">
              Sign in
            </Link>{' '}
            to enroll in this program.
          </p>
        ) : (
          <div className="mb-6">
            <Button
              variant="secondary"
              disabled={enrollMutation.isPending || enrollMutation.isSuccess}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isSuccess ? 'Enrolled' : 'Enroll in program'}
            </Button>
            {enrollMutation.isError ? (
              <p className="mt-2 text-xs text-error">Enrollment failed — check membership access.</p>
            ) : null}
          </div>
        )
      ) : ownsProgram ? (
        <p className="mb-6 text-sm text-on-surface-variant">
          You own this program — open any course below to start learning.
        </p>
      ) : isGuest ? (
        <p className="mb-6 text-sm text-on-surface-variant">
          <Link href={`/login?next=${programPath}`} className="text-primary">
            Sign in
          </Link>{' '}
          to purchase{priceLabel ? ` (${priceLabel})` : ''}.
        </p>
      ) : (
        <div className="mb-6">
          <Button
            variant="secondary"
            disabled={checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending
              ? 'Redirecting…'
              : `Buy program${priceLabel ? ` · ${priceLabel}` : ''}`}
          </Button>
          {checkoutMutation.isError ? (
            <p className="mt-2 text-xs text-error">
              Checkout failed — ensure billing is enabled and the creator has Connect set up.
            </p>
          ) : null}
        </div>
      )}

      <h2 className="font-label-caps mb-3 text-outline">Courses in this program</h2>
      <ul className="space-y-3">
        {program.courses.map((item, i) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {i + 1}. {item.course?.title ?? 'Course'}
              </p>
            </div>
            {item.course?.id ? (
              <Link href={`/courses/${item.course.id}`}>
                <Button variant="outline" className="text-sm">
                  Open course
                </Button>
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
