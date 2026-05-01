// ── Constants and configuration ──

export const MODEL_VERSION = 'mobilenet-v2-1.0';

/** Supported image MIME types */
export const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
]);

/** Maximum file size for indexing (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Thumbnail dimensions */
export const THUMBNAIL_SIZE = 200;

/** Embedding vector dimension (MobileNet V2 penultimate layer) */
export const EMBEDDING_DIM = 1024;

/** MobileNet input size */
export const MODEL_INPUT_SIZE = 224;

/** Batch size for indexing operations */
export const DEFAULT_BATCH_SIZE = 10;

/** Max images to index */
export const MAX_INDEX_SIZE = 5000;

/** Max search results */
export const DEFAULT_MAX_RESULTS = 50;

/** Google API configuration — fill these in with your own credentials */
export const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY';
export const GOOGLE_CLIENT_ID = '245102192929-6drvl6tuakg1mq4qmbq70mc5hr0v4eoo.apps.googleusercontent.com';
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
export const GOOGLE_PICKER_API_URL = 'https://apis.google.com/js/api.js';

/** IndexedDB database name */
export const DB_NAME = 'ImageSimilaritySearchDB';
export const DB_VERSION = 1;

/** Context menu ID */
export const CONTEXT_MENU_ID = 'search-similar-image';
