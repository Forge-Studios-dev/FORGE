'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AdminProfile = {
  id: string;
  email: string;
  role: string;
  adminTier?: 'full' | 'moderator';
};

export function useAdminProfile() {
  return useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AdminProfile }>('/users/me');
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function isFullAdmin(profile: AdminProfile | undefined): boolean {
  if (!profile) return false;
  return profile.role !== 'admin' || profile.adminTier !== 'moderator';
}

/** Nav routes restricted to full platform admins (billing, fraud, platform ops). */
export const FULL_ADMIN_ONLY_HREFS = new Set([
  '/fraud',
  '/billing',
  '/analytics',
  '/settings',
]);
