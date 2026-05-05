import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getEmbeddingEngine } from '../shared/embedding/engine';
import { cosineSimilarity } from '../shared/embedding/similarity';
import { getAllImages, getAllEmbeddings, getImageCount } from '../shared/storage/db';
import { loadImage, fileToDataUrl } from '../shared/utils/image-processing';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../shared/theme';
import type { ScoredResult } from '../shared/types';

export function Popup() {
  const [queryImage, setQueryImage] = useState<string | null>(null);
  const [queryName, setQueryName] = useState('');
  const [results, setResults] = useState<ScoredResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [indexCount, setIndexCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load index stats on mount
  useEffect(() => {
    getImageCount().then(setIndexCount);
  }, []);

  // Listen for paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await fileToDataUrl(file);
    setQueryImage(dataUrl);
    setQueryName(file.name);
    await performSearch(dataUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const performSearch = async (imageDataUrl: string) => {
    setIsSearching(true);
    setResults([]);

    try {
      setSearchStatus('Loading AI model...');
      const engine = getEmbeddingEngine();
      await engine.initialize();

      setSearchStatus('Analyzing image...');
      const img = await loadImage(imageDataUrl);
      const queryEmbedding = await engine.getEmbedding(img);

      setSearchStatus('Searching...');
      const [allImages, allEmbeddings] = await Promise.all([
        getAllImages(),
        getAllEmbeddings(),
      ]);

      if (allEmbeddings.length === 0) {
        setSearchStatus('No indexed images found. Open the dashboard to index images.');
        setIsSearching(false);
        return;
      }

      const imageMap = new Map(allImages.map((im) => [im.id, im]));
      const scored: ScoredResult[] = [];

      for (const emb of allEmbeddings) {
        const image = imageMap.get(emb.imageId);
        if (!image) continue;
        try {
          const score = cosineSimilarity(queryEmbedding, emb.vector);
          scored.push({ image, score });
        } catch (err) {
          console.warn(`[Popup Search] Skipped embedding for "${image.filename}":`, (err as Error).message);
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const topResults = scored.slice(0, 6);

      // Create thumbnail object URLs
      for (const r of topResults) {
        if (r.image.thumbnailBlob) {
          r.thumbnailObjectUrl = URL.createObjectURL(r.image.thumbnailBlob);
        }
      }

      setResults(topResults);
      setSearchStatus(`Found ${scored.length} results`);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const clearQuery = () => {
    setQueryImage(null);
    setQueryName('');
    setResults([]);
    setSearchStatus('');
    // Revoke object URLs
    for (const r of results) {
      if (r.thumbnailObjectUrl) URL.revokeObjectURL(r.thumbnailObjectUrl);
    }
  };

  const openDashboard = () => {
    if (queryImage) {
      chrome.storage.session.set({
        pendingSearch: { imageDataUrl: queryImage, timestamp: Date.now() },
      });
    }
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  };

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️';

  return (
    <div className="popup">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-header-left">
          <div className="popup-logo">🔍</div>
          <span className="popup-title">ImgSearch</span>
        </div>
        <div className="popup-header-actions">
          <button className="btn-icon" onClick={toggleTheme} data-tooltip={`Theme: ${theme}`}>
            {themeIcon}
          </button>
        </div>
      </div>

      {/* Query Preview (if image selected) */}
      {queryImage && (
        <div className="popup-query-preview">
          <img className="popup-query-thumb" src={queryImage} alt="Query" />
          <div className="popup-query-info">
            <div className="popup-query-name">{queryName || 'Pasted image'}</div>
            <div className="popup-query-status">{searchStatus}</div>
          </div>
          <button className="popup-query-clear" onClick={clearQuery}>✕</button>
        </div>
      )}

      {/* Drop Zone (if no query) */}
      {!queryImage && (
        <div
          className={`drop-zone popup-dropzone ${isDragOver ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="popup-dropzone-icon">📷</div>
          <div className="popup-dropzone-text">
            Drop an image or <strong>click to browse</strong>
          </div>
          <div className="popup-dropzone-hint">
            Supports JPEG, PNG, WebP, GIF • Paste from clipboard
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Stats */}
      <div className="popup-stats">
        <div className="popup-stat">
          <div className="popup-stat-value">{indexCount}</div>
          <div className="popup-stat-label">Indexed</div>
        </div>
        <div className="popup-stat">
          <div className="popup-stat-value">{results.length}</div>
          <div className="popup-stat-label">Matches</div>
        </div>
      </div>

      {/* Results */}
      <div className="popup-results">
        {isSearching ? (
          <div className="popup-loading">
            <div className="popup-spinner" />
            <span>{searchStatus}</span>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="popup-results-title">Top Matches</div>
            <div className="popup-results-grid">
              {results.map((r) => (
                <div key={r.image.id} className="popup-result-item">
                  {r.thumbnailObjectUrl ? (
                    <img src={r.thumbnailObjectUrl} alt={r.image.filename} />
                  ) : (
                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                  )}
                  <span className="popup-result-score">
                    {Math.round(r.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : queryImage ? (
          <div className="popup-empty">
            {indexCount === 0
              ? 'No images indexed yet. Open the dashboard to add images.'
              : 'No similar images found.'}
          </div>
        ) : (
          <div className="popup-empty">
            Upload an image to find visually similar matches from your indexed collection.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="popup-footer">
        <button className="btn btn-primary" onClick={openDashboard}>
          Open Dashboard →
        </button>
      </div>
    </div>
  );
}
