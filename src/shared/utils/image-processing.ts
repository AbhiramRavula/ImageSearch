// ── Image processing utilities ──

import { THUMBNAIL_SIZE, MODEL_INPUT_SIZE, SUPPORTED_IMAGE_TYPES, MAX_FILE_SIZE } from '../constants';

/** Validate that a file is a supported image type and within size limits */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}. Supported: JPEG, PNG, WebP, GIF, BMP, SVG.` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB.` };
  }
  return { valid: true };
}

/** Load an image from a data URL, blob URL, or file:// URL and return an HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Don't set crossOrigin for local files or data URLs — CORS doesn't apply
    // and setting it causes load failures on file:// protocol
    if (!src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('file:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.substring(0, 100)}`));
    img.src = src;
  });
}

/** Convert a file to a data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Resize an image for the model input (224×224) and return as ImageData */
export function preprocessForModel(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Draw image scaled to fit the model input, maintaining aspect ratio with center crop
  const scale = Math.max(MODEL_INPUT_SIZE / img.width, MODEL_INPUT_SIZE / img.height);
  const scaledW = img.width * scale;
  const scaledH = img.height * scale;
  const offsetX = (MODEL_INPUT_SIZE - scaledW) / 2;
  const offsetY = (MODEL_INPUT_SIZE - scaledH) / 2;

  ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
  return ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
}

/** Generate a thumbnail blob from an image */
export async function generateThumbnail(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scale = Math.min(THUMBNAIL_SIZE / img.width, THUMBNAIL_SIZE / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate thumbnail'));
      },
      'image/webp',
      0.8
    );
  });
}

/** Compute a SHA-256 hash of the first 64KB of image data for deduplication */
export async function computeContentHash(data: ArrayBuffer): Promise<string> {
  // Hash first 64KB for performance — sufficient for deduplication
  const slice = data.slice(0, 65536);
  const hashBuffer = await crypto.subtle.digest('SHA-256', slice);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Get image dimensions from an HTMLImageElement */
export function getImageDimensions(img: HTMLImageElement): { width: number; height: number } {
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/** Convert a blob to an ArrayBuffer */
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

/** Generate a unique ID */
export function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/** Convert a data URL to a Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64Data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
