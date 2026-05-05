// ── Shared type definitions for the extension ──

/** Source of an indexed image */
export type ImageSource = 'local' | 'google-drive';

/** Metadata for an indexed image */
export interface IndexedImage {
  id: string;
  filename: string;
  source: ImageSource;
  sourceId?: string; // Drive file ID or local path identifier
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType: string;
  contentHash: string;
  thumbnailBlob?: Blob;
  thumbnailUrl?: string; // For Drive thumbnails
  tags?: string[]; // AI-generated classification labels (from MobileNet)
  createdAt: number;
  indexedAt: number;
}

/** Stored embedding for an image */
export interface ImageEmbedding {
  imageId: string;
  vector: Float32Array;
  modelVersion: string;
}

/** Search result with similarity score */
export interface ScoredResult {
  image: IndexedImage;
  score: number; // 0-1, higher is more similar
  thumbnailObjectUrl?: string;
}

/** Indexing progress state */
export interface IndexingProgress {
  status: 'idle' | 'loading-model' | 'indexing' | 'complete' | 'error';
  current: number;
  total: number;
  errors: string[];
  source: ImageSource;
}

/** App settings */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  maxResults: number;
  batchSize: number;
  maxIndexSize: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  maxResults: 50,
  batchSize: 10,
  maxIndexSize: 5000,
};
