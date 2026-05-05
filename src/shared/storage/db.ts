// ── IndexedDB storage layer using Dexie ──

import Dexie, { type Table } from 'dexie';
import { DB_NAME } from '../constants';
import type { IndexedImage, ImageEmbedding } from '../types';

/** Database schema for image metadata and embeddings */
class ImageSearchDB extends Dexie {
  images!: Table<IndexedImage, string>;
  embeddings!: Table<ImageEmbedding, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      images: 'id, filename, source, sourceId, contentHash, mimeType, indexedAt',
      embeddings: 'imageId',
    });
  }
}

/** Singleton database instance */
const db = new ImageSearchDB();

// ── Reading hook: ensure embedding vectors are proper Float32Arrays ──
// IndexedDB may deserialize typed arrays as plain Objects or ArrayBuffers.
db.embeddings.hook('reading', (obj) => {
  if (obj && obj.vector && !(obj.vector instanceof Float32Array)) {
    const raw: any = obj.vector;
    if (raw instanceof ArrayBuffer) {
      obj.vector = new Float32Array(raw);
    } else if (Array.isArray(raw)) {
      obj.vector = new Float32Array(raw);
    } else if (typeof raw === 'object') {
      // Plain object with numeric keys
      const keys = Object.keys(raw);
      const arr = new Float32Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        arr[i] = raw[i] ?? raw[String(i)] ?? 0;
      }
      obj.vector = arr;
    }
  }
  return obj;
});

// ── Image operations ──

export async function addImage(image: IndexedImage): Promise<void> {
  await db.images.put(image);
}

export async function addImages(images: IndexedImage[]): Promise<void> {
  await db.images.bulkPut(images);
}

export async function getImage(id: string): Promise<IndexedImage | undefined> {
  return db.images.get(id);
}

export async function getAllImages(source?: 'local' | 'google-drive'): Promise<IndexedImage[]> {
  if (source) {
    return db.images.where('source').equals(source).toArray();
  }
  return db.images.toArray();
}

export async function deleteImage(id: string): Promise<void> {
  await db.transaction('rw', db.images, db.embeddings, async () => {
    await db.images.delete(id);
    await db.embeddings.delete(id);
  });
}

export async function clearImages(source?: 'local' | 'google-drive'): Promise<void> {
  if (source) {
    const ids = await db.images.where('source').equals(source).primaryKeys();
    await db.transaction('rw', db.images, db.embeddings, async () => {
      await db.images.bulkDelete(ids);
      await db.embeddings.bulkDelete(ids);
    });
  } else {
    await db.transaction('rw', db.images, db.embeddings, async () => {
      await db.images.clear();
      await db.embeddings.clear();
    });
  }
}

export async function getImageByHash(contentHash: string): Promise<IndexedImage | undefined> {
  return db.images.where('contentHash').equals(contentHash).first();
}

export async function getImageCount(source?: 'local' | 'google-drive'): Promise<number> {
  if (source) {
    return db.images.where('source').equals(source).count();
  }
  return db.images.count();
}

// ── Embedding operations ──

export async function addEmbedding(embedding: ImageEmbedding): Promise<void> {
  await db.embeddings.put(embedding);
}

export async function addEmbeddings(embeddings: ImageEmbedding[]): Promise<void> {
  await db.embeddings.bulkPut(embeddings);
}

export async function getEmbedding(imageId: string): Promise<ImageEmbedding | undefined> {
  return db.embeddings.get(imageId);
}

export async function getAllEmbeddings(): Promise<ImageEmbedding[]> {
  return db.embeddings.toArray();
}

export async function getEmbeddingsForSource(source: 'local' | 'google-drive'): Promise<ImageEmbedding[]> {
  const imageIds = await db.images.where('source').equals(source).primaryKeys();
  const embeddings = await db.embeddings.bulkGet(imageIds);
  return embeddings.filter((e): e is ImageEmbedding => e !== undefined);
}

// ── Stats ──

export async function getIndexStats() {
  const [totalImages, localImages, driveImages] = await Promise.all([
    db.images.count(),
    db.images.where('source').equals('local').count(),
    db.images.where('source').equals('google-drive').count(),
  ]);

  return {
    totalImages,
    localImages,
    driveImages,
    // Approximate storage — actual estimation would require iterating blobs
    storageUsed: 0,
  };
}

export { db };
