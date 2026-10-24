import { apiFetch } from './apiClient';

export type PortfolioMediaCategory = 'resume' | 'profile' | 'certificates' | 'project';

export async function uploadPortfolioMedia(file: File, category: PortfolioMediaCategory): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('storageCategory', category);
  const response = await apiFetch('/api/files/portfolio-media', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || !data.success || typeof data.file?.url !== 'string') {
    throw new Error(data.error || 'Portfolio media upload failed.');
  }
  return data.file.url;
}
