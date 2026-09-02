'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformPublicConfig, PlatformSkillFeatures } from '@forge/shared-types';
import {
  isChannelPointsFeatureEnabled,
  isCoursesFeatureEnabled,
  isMentorshipFeatureEnabled,
  isSkillEconomyLmsEnabled,
} from '@forge/shared-types';
import { api } from '@/lib/api';

const defaultSkillFeatures: PlatformSkillFeatures = {
  courses: false,
  mentorship: false,
  channelPoints: false,
  skillEconomyLms: false,
};

async function fetchPlatformConfig(): Promise<PlatformPublicConfig> {
  const { data } = await api.get<{ data: PlatformPublicConfig }>('/platform/config');
  return data.data ?? { featureFlags: [], apiVersion: 'v1' };
}

/** Client hook — skill module flags from GET /platform/config. */
export function useSkillFeatures() {
  const query = useQuery({
    queryKey: ['platform-config'],
    queryFn: fetchPlatformConfig,
    staleTime: 60_000,
  });

  const config = query.data;
  const skillFeatures = config?.skillFeatures ?? defaultSkillFeatures;

  return {
    ...query,
    skillFeatures,
    coursesEnabled: isCoursesFeatureEnabled(config ?? { featureFlags: [], apiVersion: 'v1' }),
    mentorshipEnabled: isMentorshipFeatureEnabled(config ?? { featureFlags: [], apiVersion: 'v1' }),
    channelPointsEnabled: isChannelPointsFeatureEnabled(
      config ?? { featureFlags: [], apiVersion: 'v1' },
    ),
    skillEconomyLms: isSkillEconomyLmsEnabled(config ?? { featureFlags: [], apiVersion: 'v1' }),
  };
}
