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
  const [queryText, setQueryText] = useState('');

  const search = useCallback(
    async (
      imageDataUrl: string,
      filename: string,
      sourceFilter: ImageSource | 'all' = 'all',
      maxResults = 50
    ) => {
      setQueryImage(imageDataUrl);
      setQueryName(filename);
      setQueryText('');
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

        let skippedCount = 0;
        for (const emb of embeddings) {
          const image = imageMap.get(emb.imageId);
          if (!image) continue;

          // Apply source filter
          if (sourceFilter !== 'all' && image.source !== sourceFilter) continue;

          try {
            const score = cosineSimilarity(queryEmbedding, emb.vector);
            scored.push({ image, score });
          } catch (err) {
            skippedCount++;
            console.warn(`[Search] Skipped embedding for "${image.filename}":`, (err as Error).message);
          }
        }

        if (skippedCount > 0) {
          console.warn(`[Search] Skipped ${skippedCount} embeddings due to errors`);
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

  /** Search by text query — matches against AI tags and filenames */
  const searchByText = useCallback(
    async (
      query: string,
      sourceFilter: ImageSource | 'all' = 'all',
      maxResults = 50
    ) => {
      if (!query.trim()) return;

      setQueryImage(null);
      setQueryName('');
      setQueryText(query);
      setIsSearching(true);
      setResults([]);

      try {
        setSearchStatus('Searching by text...');
        const allImages = await getAllImages();

        if (allImages.length === 0) {
          setSearchStatus('No indexed images found');
          setIsSearching(false);
          return;
        }

        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/).filter(Boolean);
        const scored: ScoredResult[] = [];

        for (const image of allImages) {
          // Apply source filter
          if (sourceFilter !== 'all' && image.source !== sourceFilter) continue;

          let score = 0;
          const filenameLower = image.filename.toLowerCase();

          // Score based on tag matches (high weight)
          if (image.tags && image.tags.length > 0) {
            for (const tag of image.tags) {
              const tagLower = tag.toLowerCase();
              // Exact tag match → high score
              if (tagLower === queryLower) {
                score += 0.9;
              }
              // Query is contained in tag
              else if (tagLower.includes(queryLower)) {
                score += 0.7;
              }
              // Any query word matches tag
              else {
                for (const word of queryWords) {
                  if (tagLower.includes(word)) {
                    score += 0.5;
                  }
                }
              }
            }
          }

          // Score based on filename match (medium weight)
          if (filenameLower.includes(queryLower)) {
            score += 0.6;
          } else {
            for (const word of queryWords) {
              if (filenameLower.includes(word)) {
                score += 0.3;
              }
            }
          }

          // Only include if there's some match
          if (score > 0) {
            // Clamp score to [0, 1]
            score = Math.min(1, score);
            scored.push({ image, score });
          }
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
        if (topResults.length > 0) {
          setSearchStatus(`Found ${topResults.length} match${topResults.length !== 1 ? 'es' : ''} for "${query}"`);
        } else {
          setSearchStatus(`No matches found for "${query}"`);
        }
      } catch (err) {
        console.error('Text search failed:', err);
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
    setQueryText('');
    setResults([]);
    setSearchStatus('');
  }, [results]);

  return {
    results,
    isSearching,
    searchStatus,
    queryImage,
    queryName,
    queryText,
    search,
    searchByText,
    clearSearch,
  };
}

