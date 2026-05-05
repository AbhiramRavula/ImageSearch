// ── Cosine similarity computation ──
// Pure TypeScript — no TF.js dependency for the math.
// Vectors are assumed to be L2-normalized, so cosine sim = dot product.

import type { IndexedImage, ScoredResult, ImageEmbedding } from '../types';

/**
 * Ensure a value is a proper Float32Array.
 * IndexedDB/Dexie may deserialize Float32Array as a plain Object, ArrayBuffer,
 * or regular Array. This handles all those cases.
 */
export function ensureFloat32Array(value: unknown): Float32Array {
  if (value instanceof Float32Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Float32Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    // Uint8Array, Int32Array, DataView, etc.
    return new Float32Array(value.buffer, value.byteOffset, value.byteLength / 4);
  }
  if (Array.isArray(value)) {
    return new Float32Array(value);
  }
  // Plain object with numeric keys (Dexie deserialization artifact)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, number>;
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      const arr = new Float32Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        arr[i] = obj[i] ?? obj[String(i)] ?? 0;
      }
      return arr;
    }
  }
  throw new Error(`Cannot convert value to Float32Array: ${typeof value}`);
}

/** Compute cosine similarity between two vectors (assumes L2-normalized) */
export function cosineSimilarity(a: Float32Array | unknown, b: Float32Array | unknown): number {
  const va = ensureFloat32Array(a);
  const vb = ensureFloat32Array(b);

  if (va.length !== vb.length) {
    throw new Error(`Vector dimension mismatch: ${va.length} vs ${vb.length}`);
  }

  let dot = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
  }

  // Clamp to [-1, 1] to handle floating-point precision issues
  return Math.max(-1, Math.min(1, dot));
}

/** Rank indexed images by similarity to a query embedding */
export function rankBySimilarity(
  queryEmbedding: Float32Array,
  embeddings: ImageEmbedding[],
  images: Map<string, IndexedImage>,
  maxResults: number = 50,
  sourceFilter?: 'local' | 'google-drive' | 'all'
): ScoredResult[] {
  const results: ScoredResult[] = [];

  for (const emb of embeddings) {
    const image = images.get(emb.imageId);
    if (!image) continue;

    // Apply source filter
    if (sourceFilter && sourceFilter !== 'all' && image.source !== sourceFilter) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, emb.vector);

    results.push({
      image,
      score,
    });
  }

  // Sort by score descending (most similar first)
  results.sort((a, b) => b.score - a.score);

  // Return top N
  return results.slice(0, maxResults);
}

/** Convert a similarity score (0-1) to a percentage string */
export function scoreToPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}
