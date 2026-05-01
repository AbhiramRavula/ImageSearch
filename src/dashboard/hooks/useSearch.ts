import { useState, useCallback } from 'react';
import { getEmbeddingEngine } from '../../shared/embedding/engine';
import { cosineSimilarity } from '../../shared/embedding/similarity';
import { getAllImages, getAllEmbeddings, getEmbeddingsForSource } from '../../shared/storage/db';
import { loadImage } from '../../shared/utils/image-processing';
import type { ScoredResult, ImageSource } from '../../shared/types';

export function useSearch() {
  const [results, setResults] = useState<ScoredResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [queryImage, setQueryImage] = useState<string | null>(null);
  const [queryName, setQueryName] = useState('');

  const search = useCallback(
    async (
      imageDataUrl: string,
      filename: string,
      sourceFilter: ImageSource | 'all' = 'all',
      maxResults = 50
    ) => {
      setQueryImage(imageDataUrl);
      setQueryName(filename);
      setIsSearching(true);
      setResults([]);

      try {
        setSearchStatus('Loading AI model...');
        const engine = getEmbeddingEngine();
        await engine.initialize();

        setSearchStatus('Analyzing image...');
        const img = await loadImage(imageDataUrl);
        const queryEmbedding = await engine.getEmbedding(img);

        setSearchStatus('Searching index...');
        const [allImages, embeddings] = await Promise.all([
          getAllImages(),
          sourceFilter === 'all'
            ? getAllEmbeddings()
            : getEmbeddingsForSource(sourceFilter),
        ]);

        if (embeddings.length === 0) {
          setSearchStatus('No indexed images found');
          setIsSearching(false);
          return;
        }

        const imageMap = new Map(allImages.map((im) => [im.id, im]));
        const scored: ScoredResult[] = [];

        for (const emb of embeddings) {
          const image = imageMap.get(emb.imageId);
          if (!image) continue;

          // Apply source filter
          if (sourceFilter !== 'all' && image.source !== sourceFilter) continue;

          const score = cosineSimilarity(queryEmbedding, emb.vector);
          scored.push({ image, score });
        }

        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, maxResults);

        // Create thumbnail object URLs
        for (const r of topResults) {
          if (r.image.thumbnailBlob) {
            r.thumbnailObjectUrl = URL.createObjectURL(r.image.thumbnailBlob);
          }
        }

        setResults(topResults);
        setSearchStatus(`Found ${topResults.length} result${topResults.length !== 1 ? 's' : ''}`);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchStatus(`Error: ${(err as Error).message}`);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const clearSearch = useCallback(() => {
    // Revoke object URLs
    for (const r of results) {
      if (r.thumbnailObjectUrl) URL.revokeObjectURL(r.thumbnailObjectUrl);
    }
    setQueryImage(null);
    setQueryName('');
    setResults([]);
    setSearchStatus('');
  }, [results]);

  return {
    results,
    isSearching,
    searchStatus,
    queryImage,
    queryName,
    search,
    clearSearch,
  };
}
