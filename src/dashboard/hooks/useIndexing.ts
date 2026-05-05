import { useState, useCallback, useRef } from 'react';
import { getEmbeddingEngine } from '../../shared/embedding/engine';
import {
  loadImage,
  generateThumbnail,
  computeContentHash,
  generateId,
  dataUrlToBlob,
  validateImageFile,
  getImageDimensions,
  fileToDataUrl,
} from '../../shared/utils/image-processing';
import {
  addImage,
  addEmbedding,
  getImageByHash,
  getImageCount,
  getAllImages,
} from '../../shared/storage/db';
import type { IndexingProgress, IndexedImage, ImageEmbedding } from '../../shared/types';
import { MODEL_VERSION } from '../../shared/constants';

export function useIndexing() {
  const [progress, setProgress] = useState<IndexingProgress>({
    status: 'idle',
    current: 0,
    total: 0,
    errors: [],
    source: 'local',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const indexLocalFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate files
    for (const file of files) {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (validFiles.length === 0) {
      setProgress({ status: 'error', current: 0, total: 0, errors, source: 'local' });
      return;
    }

    setProgress({
      status: 'loading-model',
      current: 0,
      total: validFiles.length,
      errors,
      source: 'local',
    });

    try {
      // Initialize embedding engine
      const engine = getEmbeddingEngine();
      await engine.initialize();

      setProgress((prev) => ({ ...prev, status: 'indexing' }));

      const BATCH_SIZE = 5;
      for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
        const batch = validFiles.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < batch.length; j++) {
          const file = batch[j];
          const current = i + j + 1;

          try {
            // Read file
            const dataUrl = await fileToDataUrl(file);
            const blob = dataUrlToBlob(dataUrl);
            const arrayBuffer = await blob.arrayBuffer();

            // Check for duplicates
            const hash = await computeContentHash(arrayBuffer);
            const existing = await getImageByHash(hash);
            if (existing) {
              setProgress((prev) => ({
                ...prev,
                current,
                errors: [...prev.errors, `${file.name}: Duplicate (skipped)`],
              }));
              continue;
            }

            // Load image element for processing
            const img = await loadImage(dataUrl);
            const dims = getImageDimensions(img);

            // Generate thumbnail
            const thumbnailBlob = await generateThumbnail(img);

            // Generate embedding
            const vector = await engine.getEmbedding(img);

            // Classify image for text search tags
            let tags: string[] = [];
            try {
              const predictions = await engine.classifyImage(img, 5);
              tags = predictions
                .filter((p) => p.probability > 0.05)
                .flatMap((p) => p.className.split(', ').map((t) => t.trim().toLowerCase()));
            } catch {
              // Classification is best-effort — don't fail indexing
            }

            // Store in IndexedDB
            const id = generateId();
            const imageRecord: IndexedImage = {
              id,
              filename: file.name,
              source: 'local',
              width: dims.width,
              height: dims.height,
              fileSize: file.size,
              mimeType: file.type,
              contentHash: hash,
              thumbnailBlob,
              tags,
              createdAt: file.lastModified,
              indexedAt: Date.now(),
            };

            const embeddingRecord: ImageEmbedding = {
              imageId: id,
              vector,
              modelVersion: MODEL_VERSION,
            };

            await addImage(imageRecord);
            await addEmbedding(embeddingRecord);

            setProgress((prev) => ({ ...prev, current }));
          } catch (err) {
            setProgress((prev) => ({
              ...prev,
              current: i + j + 1,
              errors: [...prev.errors, `${file.name}: ${(err as Error).message}`],
            }));
          }
        }

        // Yield to UI between batches
        await new Promise((r) => setTimeout(r, 50));
      }

      setProgress((prev) => ({ ...prev, status: 'complete' }));

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'local' });
      }, 3000);
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, `Fatal: ${(err as Error).message}`],
      }));
    }
  }, []);

  const triggerLocalFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Open a folder picker and recursively scan for image files */
  const triggerFolderSelect = useCallback(async () => {
    try {
      // showDirectoryPicker is available in Chrome/Edge
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      const imageFiles: File[] = [];

      // Recursively collect image files from the folder
      async function scanDirectory(handle: any, path: string = '') {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            const file: File = await entry.getFile();
            if (file.type.startsWith('image/')) {
              // Preserve folder path in the filename for context
              const fullName = path ? `${path}/${file.name}` : file.name;
              const renamedFile = new File([file], fullName, {
                type: file.type,
                lastModified: file.lastModified,
              });
              imageFiles.push(renamedFile);
            }
          } else if (entry.kind === 'directory') {
            const subPath = path ? `${path}/${entry.name}` : entry.name;
            await scanDirectory(entry, subPath);
          }
        }
      }

      setProgress({
        status: 'indexing',
        current: 0,
        total: 0,
        errors: [],
        source: 'local',
      });

      await scanDirectory(dirHandle);

      if (imageFiles.length === 0) {
        setProgress({
          status: 'error',
          current: 0,
          total: 0,
          errors: ['No image files found in the selected folder.'],
          source: 'local',
        });
        setTimeout(() => {
          setProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'local' });
        }, 3000);
        return;
      }

      // Feed collected files into the existing indexing pipeline
      await indexLocalFiles(imageFiles);
    } catch (err: any) {
      // User cancelled the picker — that's fine, ignore AbortError
      if (err?.name === 'AbortError') return;
      console.error('Folder selection failed:', err);
      setProgress({
        status: 'error',
        current: 0,
        total: 0,
        errors: [`Folder selection failed: ${err.message}`],
        source: 'local',
      });
    }
  }, [indexLocalFiles, setProgress]);

  /** Index images from an array of file:/// URLs (used by folder auto-indexing) */
  const indexFromUrls = useCallback(async (urls: string[], folderPath?: string) => {
    if (urls.length === 0) return;

    const errors: string[] = [];

    setProgress({
      status: 'loading-model',
      current: 0,
      total: urls.length,
      errors,
      source: 'local',
    });

    try {
      const engine = getEmbeddingEngine();
      await engine.initialize();

      setProgress((prev) => ({ ...prev, status: 'indexing' }));

      const BATCH_SIZE = 5;
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < batch.length; j++) {
          const url = batch[j];
          const current = i + j + 1;
          const filename = decodeURIComponent(url.split('/').pop() || `image_${current}`);

          try {
            // Load image directly from file:/// URL
            const img = await loadImage(url);
            const dims = getImageDimensions(img);

            // Generate a content hash from a canvas snapshot (since we can't fetch file:// as ArrayBuffer from extension pages reliably)
            const hashCanvas = document.createElement('canvas');
            hashCanvas.width = Math.min(img.naturalWidth, 256);
            hashCanvas.height = Math.min(img.naturalHeight, 256);
            const hashCtx = hashCanvas.getContext('2d')!;
            hashCtx.drawImage(img, 0, 0, hashCanvas.width, hashCanvas.height);
            const hashDataUrl = hashCanvas.toDataURL('image/png');
            const hashBlob = dataUrlToBlob(hashDataUrl);
            const hashBuffer = await hashBlob.arrayBuffer();
            const hash = await computeContentHash(hashBuffer);

            // Check for duplicates
            const existing = await getImageByHash(hash);
            if (existing) {
              setProgress((prev) => ({
                ...prev,
                current,
                errors: [...prev.errors, `${filename}: Duplicate (skipped)`],
              }));
              continue;
            }

            // Generate thumbnail
            const thumbnailBlob = await generateThumbnail(img);

            // Generate embedding
            const vector = await engine.getEmbedding(img);

            // Classify image for text search tags
            let tags: string[] = [];
            try {
              const predictions = await engine.classifyImage(img, 5);
              tags = predictions
                .filter((p) => p.probability > 0.05)
                .flatMap((p) => p.className.split(', ').map((t) => t.trim().toLowerCase()));
            } catch {
              // Classification is best-effort
            }

            // Guess mime type from extension
            const ext = filename.split('.').pop()?.toLowerCase() || '';
            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
              svg: 'image/svg+xml',
            };
            const mimeType = mimeMap[ext] || 'image/unknown';

            // Store in IndexedDB
            const id = generateId();
            const imageRecord: IndexedImage = {
              id,
              filename,
              source: 'local',
              sourceId: url,
              width: dims.width,
              height: dims.height,
              mimeType,
              contentHash: hash,
              thumbnailBlob,
              tags,
              createdAt: Date.now(),
              indexedAt: Date.now(),
            };

            const embeddingRecord: ImageEmbedding = {
              imageId: id,
              vector,
              modelVersion: MODEL_VERSION,
            };

            await addImage(imageRecord);
            await addEmbedding(embeddingRecord);

            setProgress((prev) => ({ ...prev, current }));
          } catch (err) {
            const errMsg = (err as Error).message;
            console.warn(`[Indexing] Failed to index ${filename}:`, errMsg);
            setProgress((prev) => ({
              ...prev,
              current: i + j + 1,
              errors: [...prev.errors, `${filename}: ${errMsg}`],
            }));
          }
        }

        // Yield to UI between batches
        await new Promise((r) => setTimeout(r, 50));
      }

      setProgress((prev) => ({ ...prev, status: 'complete' }));

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'local' });
      }, 5000);
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, `Fatal: ${(err as Error).message}`],
      }));
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) indexLocalFiles(files);
      e.target.value = '';
    },
    [indexLocalFiles]
  );

  return {
    progress,
    setProgress,
    indexLocalFiles,
    indexFromUrls,
    triggerLocalFileSelect,
    triggerFolderSelect,
    handleFileInputChange,
    fileInputRef,
  };
}
