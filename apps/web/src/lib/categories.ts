import { api } from '@/lib/api';

export type UploadSkillTag = {
  id: string;
  name: string;
  slug: string;
};

export type UploadCategoryOption = {
  id: string;
  name: string;
  slug: string;
  skillTags: UploadSkillTag[];
};

export async function fetchUploadOptions(): Promise<UploadCategoryOption[]> {
  const { data } = await api.get<{ data: UploadCategoryOption[] }>('/categories/upload-options');
  return data.data ?? [];
}

/** Topic tags available for a single category (re-tagging an existing video). */
export async function fetchCategorySkillTags(categoryId: string): Promise<UploadSkillTag[]> {
  const { data } = await api.get<UploadSkillTag[]>(`/categories/${categoryId}/skill-tags`);
  return data ?? [];
}
