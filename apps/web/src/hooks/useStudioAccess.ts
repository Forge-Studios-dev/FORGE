'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export type ModeratedCommunity = {
  communityId: string;
  role: string;
  community?: {
    id: string;
    name: string;
    slug: string;
    creatorId: string;
    creator?: { username?: string; displayName?: string };
  } | null;
};

export type StudioAccessMode = 'creator' | 'collaborator' | 'none' | 'loading';

/**
 * Creator gets full Studio. Viewers with delegated community roles
 * (moderator/admin/coach) get a restricted collaborator shell.
 */
export function useStudioAccess() {
  const { user, isCreator, isGuest, accessTier, isLoading: authLoading } = useAuth();

  const { data: moderated = [], isLoading: modLoading, isFetched } = useQuery({
    queryKey: ['moderated-communities', user?.id],
    enabled: !!user?.id && !isCreator && accessTier === 'viewer',
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: ModeratedCommunity[] } }>(
        '/creators/me/moderated-communities',
      );
      return data.data.data ?? [];
    },
    staleTime: 60_000,
  });

  if (authLoading || isGuest) {
    return {
      mode: (authLoading ? 'loading' : 'none') as StudioAccessMode,
      isCreator: false,
      isCollaborator: false,
      moderated: [] as ModeratedCommunity[],
      primaryRole: null as string | null,
      isLoading: authLoading,
    };
  }

  if (isCreator) {
    return {
      mode: 'creator' as const,
      isCreator: true,
      isCollaborator: false,
      moderated,
      primaryRole: 'creator',
      isLoading: false,
    };
  }

  if (accessTier === 'viewer' && !isFetched && modLoading) {
    return {
      mode: 'loading' as const,
      isCreator: false,
      isCollaborator: false,
      moderated: [] as ModeratedCommunity[],
      primaryRole: null,
      isLoading: true,
    };
  }

  if (moderated.length > 0) {
    const roles = moderated.map((m) => m.role);
    const primaryRole = roles.includes('admin')
      ? 'admin'
      : roles.includes('coach')
        ? 'coach'
        : roles.includes('moderator')
          ? 'moderator'
          : roles[0] ?? 'collaborator';
    return {
      mode: 'collaborator' as const,
      isCreator: false,
      isCollaborator: true,
      moderated,
      primaryRole,
      isLoading: false,
    };
  }

  return {
    mode: 'none' as const,
    isCreator: false,
    isCollaborator: false,
    moderated: [] as ModeratedCommunity[],
    primaryRole: null,
    isLoading: false,
  };
}
