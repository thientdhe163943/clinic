import { apiClient, unwrap } from '../client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
// Uploaded files are served from the backend's static /uploads/* route (see
// main.ts useStaticAssets), which sits outside the /api/v1 prefix — strip it
// to get the plain origin to prefix onto the relative URL the upload
// endpoint returns.
const API_ORIGIN = API_BASE.replace(/\/api\/v\d+\/?$/, '');

export const uploadsApi = {
  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap<{ url: string }>(
      apiClient.post('/uploads/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  },
};

// Locally-uploaded avatars come back as a path relative to the backend
// origin (e.g. "/uploads/avatars/xxx.png"); pre-existing seeded avatarUrl
// values are already full external URLs — pass those through unchanged.
export function resolveAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}
