// ── Cosine similarity computation ──
// Pure TypeScript — no TF.js dependency for the math.
// Vectors are assumed to be L2-normalized, so cosine sim = dot product.

import type { IndexedImage, ScoredResult, ImageEmbedding } from '../types';

/** Compute cosine similarity between two vectors (assumes L2-normalized) */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
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
