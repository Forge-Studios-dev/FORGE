const STORAGE_KEY = 'forge_upload_draft';

export type PublishMode = 'immediate' | 'scheduled';
export type UploadVisibility = 'public' | 'unlisted' | 'private';

export type UploadDraft = {
  title: string;
  description: string;
  categoryId: string;
  skillTagIds: string[];
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  publishMode: PublishMode;
  scheduledAt: string;
  visibility: UploadVisibility;
  playlistIds: string[];
};

const DEFAULT_DRAFT: UploadDraft = {
  title: '',
  description: '',
  categoryId: '',
  skillTagIds: [],
  publishMode: 'immediate',
  scheduledAt: '',
  visibility: 'public',
  playlistIds: [],
};

export function getUploadDraft(): UploadDraft {
  if (typeof window === 'undefined') return { ...DEFAULT_DRAFT };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DRAFT };
    const parsed = JSON.parse(raw) as Partial<UploadDraft> & { skillTag?: string };
    const skillTagIds =
      parsed.skillTagIds ??
      (parsed.skillTag ? [] : []);
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      skillTagIds,
      categoryId: parsed.categoryId ?? '',
    };
  } catch {
    return { ...DEFAULT_DRAFT };
  }
}

export function saveUploadDraft(draft: Partial<UploadDraft>) {
  const next = { ...getUploadDraft(), ...draft };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearUploadDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}
