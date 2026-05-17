'use client';

import Link from 'next/link';

export function AdminUserLink({
  userId,
  username,
  displayName,
  className = '',
}: {
  userId: string;
  username?: string;
  displayName?: string;
  className?: string;
}) {
  const label = displayName || (username ? `@${username}` : 'View user');
  return (
    <Link
      href={`/users/${userId}`}
      className={`text-primary hover:underline ${className}`}
    >
      {label}
      {username && displayName ? (
        <span className="ml-1 text-xs text-outline">@{username}</span>
      ) : null}
    </Link>
  );
}
