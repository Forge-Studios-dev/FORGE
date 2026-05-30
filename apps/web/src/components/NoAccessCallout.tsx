'use client';

import Link from 'next/link';
import { loginHrefWithNext, currentReturnPath } from '@/lib/safe-return-path';

export function NoAccessCallout({
  title = 'You don’t have access',
  description = 'Your account does not have permission to view this content.',
}: {
  title?: string;
  description?: string;
}) {
  const signInHref = loginHrefWithNext(currentReturnPath());

  return (
    <div className="glass rounded-2xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-gray-400 mt-1">{description}</p>
      <div className="mt-4 flex gap-3">
        <Link
          href="/"
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-4 py-2 rounded-lg transition"
        >
          Go home
        </Link>
        <Link
          href={signInHref}
          className="bg-forge-600 hover:bg-forge-500 text-white font-semibold px-4 py-2 rounded-lg transition"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
