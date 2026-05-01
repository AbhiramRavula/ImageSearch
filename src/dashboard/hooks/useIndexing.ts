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
    triggerLocalFileSelect,
    triggerFolderSelect,
    handleFileInputChange,
    fileInputRef,
  };
}
