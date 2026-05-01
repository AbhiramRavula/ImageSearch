import { useState, useCallback } from 'react';
import { getAuthToken, isAuthenticated, signOut } from '../../shared/google/auth';
import { fetchFilesMetadata, downloadFileBlob } from '../../shared/google/drive';
import { getEmbeddingEngine } from '../../shared/embedding/engine';
import {
  loadImage,
  generateThumbnail,
  computeContentHash,
  generateId,
  getImageDimensions,
} from '../../shared/utils/image-processing';
import { addImage, addEmbedding, getImageByHash } from '../../shared/storage/db';
import type { IndexingProgress, IndexedImage, ImageEmbedding } from '../../shared/types';
import { MODEL_VERSION } from '../../shared/constants';

/** Extract a Google Drive folder ID from various URL formats */
function extractFolderId(input: string): string | null {
  const trimmed = input.trim();

  // Direct folder ID (no URL)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  // https://drive.google.com/drive/folders/FOLDER_ID
  const folderMatch = trimmed.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // https://drive.google.com/drive/u/0/folders/FOLDER_ID?...
  const folderMatch2 = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch2) return folderMatch2[1];

  return null;
}

/** List all image files in a specific Drive folder */
async function listImagesInFolder(
  folderId: string,
  token: string
): Promise<{ files: Array<{ id: string; name: string; mimeType: string }>; error?: string }> {
  const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: '100',
        orderBy: 'name',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!resp.ok) {
        if (resp.status === 404) return { files: [], error: 'Folder not found. Check the link and make sure you have access.' };
        if (resp.status === 401 || resp.status === 403) return { files: [], error: 'Permission denied. Sign in again or check folder sharing settings.' };
        return { files: [], error: `Drive API error: ${resp.status}` };
      }

      const data = await resp.json();
      allFiles.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } while (pageToken && allFiles.length < 500); // cap at 500 images per folder

    return { files: allFiles };
  } catch (err) {
    return { files: [], error: (err as Error).message };
  }
}

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkConnection = useCallback(async () => {
    const authed = await isAuthenticated();
    setIsConnected(authed);
    return authed;
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken(true);
      setIsConnected(true);
      return token;
    } catch (err) {
      console.error('Google auth failed:', err);
      alert(`Google sign-in failed: ${(err as Error).message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await signOut();
    setIsConnected(false);
  }, []);

  const indexDriveFiles = useCallback(
    async (
      fileIds: string[],
      onProgress: (progress: IndexingProgress) => void
    ) => {
      const token = await getAuthToken(true);
      if (!token) return;

      onProgress({
        status: 'loading-model',
        current: 0,
        total: fileIds.length,
        errors: [],
        source: 'google-drive',
      });

      const engine = getEmbeddingEngine();
      await engine.initialize();

      onProgress({
        status: 'indexing',
        current: 0,
        total: fileIds.length,
        errors: [],
        source: 'google-drive',
      });

      const { results: fileMetas, errors: metaErrors } = await fetchFilesMetadata(fileIds, token);
      const errors = [...metaErrors];

      for (let i = 0; i < fileMetas.length; i++) {
        const meta = fileMetas[i];

        try {
          const blob = await downloadFileBlob(meta.id, token);
          const arrayBuffer = await blob.arrayBuffer();

          const hash = await computeContentHash(arrayBuffer);
          const existing = await getImageByHash(hash);
          if (existing) {
            errors.push(`${meta.name}: Duplicate (skipped)`);
            onProgress({
              status: 'indexing',
              current: i + 1,
              total: fileMetas.length,
              errors,
              source: 'google-drive',
            });
            continue;
          }

          const dataUrl = URL.createObjectURL(blob);
          const img = await loadImage(dataUrl);
          const dims = getImageDimensions(img);

          const thumbnailBlob = await generateThumbnail(img);
          const vector = await engine.getEmbedding(img);

          URL.revokeObjectURL(dataUrl);

          const id = generateId();
          const imageRecord: IndexedImage = {
            id,
            filename: meta.name,
            source: 'google-drive',
            sourceId: meta.id,
            width: dims.width,
            height: dims.height,
            fileSize: parseInt(meta.size || '0', 10),
            mimeType: meta.mimeType,
            contentHash: hash,
            thumbnailBlob,
            createdAt: meta.createdTime ? new Date(meta.createdTime).getTime() : Date.now(),
            indexedAt: Date.now(),
          };

          const embeddingRecord: ImageEmbedding = {
            imageId: id,
            vector,
            modelVersion: MODEL_VERSION,
          };

          await addImage(imageRecord);
          await addEmbedding(embeddingRecord);
        } catch (err) {
          const msg = (err as Error).message;
          if (msg === 'AUTH_EXPIRED') {
            errors.push('Authentication expired. Please sign in again.');
            break;
          }
          errors.push(`${meta.name}: ${msg}`);
        }

        onProgress({
          status: 'indexing',
          current: i + 1,
          total: fileMetas.length,
          errors,
          source: 'google-drive',
        });

        await new Promise((r) => setTimeout(r, 50));
      }

      onProgress({
        status: 'complete',
        current: fileMetas.length,
        total: fileMetas.length,
        errors,
        source: 'google-drive',
      });
    },
    []
  );

  /** Index images from a Drive folder URL or folder ID */
  const indexDriveFolder = useCallback(
    async (
      folderInput: string,
      onProgress: (progress: IndexingProgress) => void
    ): Promise<boolean> => {
      // Extract folder ID from the input
      const folderId = extractFolderId(folderInput);
      if (!folderId) {
        alert(
          'Invalid Google Drive folder link.\n\n' +
          'Paste a link like:\nhttps://drive.google.com/drive/folders/ABC123...\n\n' +
          'Or just the folder ID.'
        );
        return false;
      }

      // Authenticate
      const token = await connect();
      if (!token) return false;

      onProgress({
        status: 'indexing',
        current: 0,
        total: 0,
        errors: [],
        source: 'google-drive',
      });

      // List images in the folder
      const { files, error } = await listImagesInFolder(folderId, token);

      if (error) {
        alert(`Drive folder error: ${error}`);
        onProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'google-drive' });
        return false;
      }

      if (files.length === 0) {
        alert('No image files found in this Drive folder.');
        onProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'google-drive' });
        return false;
      }

      // Confirm with the user
      const proceed = confirm(
        `Found ${files.length} image(s) in this Drive folder.\n\nIndex them now?`
      );
      if (!proceed) {
        onProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'google-drive' });
        return false;
      }

      // Index all files
      const fileIds = files.map((f) => f.id);
      await indexDriveFiles(fileIds, onProgress);
      return true;
    },
    [connect, indexDriveFiles]
  );

  return {
    isConnected,
    isLoading,
    checkConnection,
    connect,
    disconnect,
    indexDriveFiles,
    indexDriveFolder,
  };
}
