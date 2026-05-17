const STORAGE_KEY = 'forge_upload_draft';

export type UploadDraft = {
  title: string;
  description: string;
  skillTag: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

export function getUploadDraft(): UploadDraft {
  if (typeof window === 'undefined') {
    return { title: '', description: '', skillTag: '' };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { title: '', description: '', skillTag: '' };
    return { title: '', description: '', skillTag: '', ...JSON.parse(raw) };
  } catch {
    return { title: '', description: '', skillTag: '' };
  }
}

export function saveUploadDraft(draft: Partial<UploadDraft>) {
  const next = { ...getUploadDraft(), ...draft };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearUploadDraft() {
  sessionStorage.removeItem(STORAGE_KEY);
}
