// ── Google Drive API file operations ──

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
  };
  thumbnailLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/** Fetch metadata for a Drive file */
export async function fetchFileMetadata(fileId: string, token: string): Promise<DriveFile> {
  const fields = 'id,name,mimeType,size,imageMediaMetadata,thumbnailLink,webContentLink,createdTime,modifiedTime';
  const resp = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Drive API error: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

/** Fetch multiple file metadata in parallel with rate limiting */
export async function fetchFilesMetadata(
  fileIds: string[],
  token: string,
  concurrency = 5
): Promise<{ results: DriveFile[]; errors: string[] }> {
  const results: DriveFile[] = [];
  const errors: string[] = [];

  // Process in batches for rate limiting
  for (let i = 0; i < fileIds.length; i += concurrency) {
    const batch = fileIds.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((id) => fetchFileMetadata(id, token))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(`${batch[j]}: ${result.reason?.message || 'Unknown error'}`);
      }
    }
  }

  return { results, errors };
}

/** Download a Drive file as a Blob */
export async function downloadFileBlob(fileId: string, token: string): Promise<Blob> {
  const resp = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Download failed: ${resp.status}`);
  }

  return resp.blob();
}

/** Get a thumbnail URL with auth (Drive thumbnails require token) */
export function getThumbnailUrl(thumbnailLink: string | undefined, token: string): string | undefined {
  if (!thumbnailLink) return undefined;
  // Drive thumbnail links need the auth token appended
  const separator = thumbnailLink.includes('?') ? '&' : '?';
  return `${thumbnailLink}${separator}access_token=${token}`;
}

/** Download a thumbnail as a Blob */
export async function downloadThumbnail(fileId: string, token: string): Promise<Blob | null> {
  try {
    // Try to get a small version of the file
    const metadata = await fetchFileMetadata(fileId, token);
    if (metadata.thumbnailLink) {
      const resp = await fetch(metadata.thumbnailLink, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) return resp.blob();
    }

    // Fallback: download the full file and we'll generate a thumbnail from it
    return null;
  } catch {
    return null;
  }
}
