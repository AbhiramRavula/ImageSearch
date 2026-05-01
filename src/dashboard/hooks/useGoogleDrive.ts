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
import { MODEL_VERSION, GOOGLE_CLIENT_ID } from '../../shared/constants';

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkConnection = useCallback(async () => {
    if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
      setIsConnected(false);
      return false;
    }
    const authed = await isAuthenticated();
    setIsConnected(authed);
    return authed;
  }, []);

  const connect = useCallback(async () => {
    if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
      alert(
        'Google Drive integration is not configured.\n\n' +
        'To enable it:\n' +
        '1. Create a Google Cloud project\n' +
        '2. Enable Drive API and Picker API\n' +
        '3. Create an OAuth 2.0 Client ID\n' +
        '4. Update GOOGLE_CLIENT_ID in src/shared/constants.ts\n' +
        '5. Update client_id in public/manifest.json'
      );
      return null;
    }

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

      // Fetch metadata for all files
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
          // Download the file
          const blob = await downloadFileBlob(meta.id, token);
          const arrayBuffer = await blob.arrayBuffer();

          // Check duplicates
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

          // Load image for processing
          const dataUrl = URL.createObjectURL(blob);
          const img = await loadImage(dataUrl);
          const dims = getImageDimensions(img);

          // Generate thumbnail & embedding
          const thumbnailBlob = await generateThumbnail(img);
          const vector = await engine.getEmbedding(img);

          URL.revokeObjectURL(dataUrl);

          // Store
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

        // Yield to UI
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

  // Simple Drive file picker (prompt-based since Google Picker requires external script)
  const openDrivePicker = useCallback(async (): Promise<string[] | null> => {
    const token = await connect();
    if (!token) return null;

    // For now, use a simple Drive API list + prompt approach
    // Full Google Picker integration would require loading the Picker API in a separate page
    try {
      const resp = await fetch(
        'https://www.googleapis.com/drive/v3/files?' +
          new URLSearchParams({
            q: "mimeType contains 'image/' and trashed = false",
            fields: 'files(id,name,mimeType,thumbnailLink)',
            pageSize: '50',
            orderBy: 'modifiedTime desc',
          }),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!resp.ok) throw new Error(`Drive API error: ${resp.status}`);

      const data = await resp.json();
      const files = data.files || [];

      if (files.length === 0) {
        alert('No image files found in your Google Drive.');
        return null;
      }

      // Return all file IDs — in a real implementation, show a file picker UI
      return files.map((f: { id: string }) => f.id);
    } catch (err) {
      console.error('Drive picker failed:', err);
      alert(`Failed to list Drive files: ${(err as Error).message}`);
      return null;
    }
  }, [connect]);

  return {
    isConnected,
    isLoading,
    checkConnection,
    connect,
    disconnect,
    indexDriveFiles,
    openDrivePicker,
  };
}
