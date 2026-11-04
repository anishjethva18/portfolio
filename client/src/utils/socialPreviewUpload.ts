import { apiFetch } from './apiClient';

export interface SocialPreviewUpload {
  id: string;
  name: string;
  url: string;
  contentType: string;
  format: string;
  width: number;
  height: number;
  encodedWidth?: number;
  encodedHeight?: number;
  sizeBytes: number;
  orientation?: number;
  animated?: boolean;
}

export async function uploadSocialPreviewImage(file: File): Promise<SocialPreviewUpload> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/api/admin/social-preview/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data.success || !data.original?.id || !data.original?.url) {
    throw new Error(data.error || 'The social image could not be uploaded.');
  }
  return data.original as SocialPreviewUpload;
}

export async function runSingleFlight<T>(
  guard: { current: boolean },
  action: () => Promise<T>,
): Promise<T | undefined> {
  if (guard.current) return undefined;
  guard.current = true;
  try {
    return await action();
  } finally {
    guard.current = false;
  }
}
