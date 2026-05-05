import React, { useState, useEffect, useCallback } from 'react';
import { SearchBar } from './components/SearchBar';
import { SourceSidebar } from './components/SourceSidebar';
import { ResultsGrid } from './components/ResultsGrid';
import { QueryPreview } from './components/QueryPreview';
import { IndexingProgress } from './components/IndexingProgress';
import { EmptyState, SkeletonGrid } from './components/EmptyState';
import { SettingsPanel } from './components/SettingsPanel';
import { useSearch } from './hooks/useSearch';
import { useIndexing } from './hooks/useIndexing';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { getImageCount, clearImages } from '../shared/storage/db';
import { applyTheme, loadTheme, saveTheme, type Theme } from '../shared/theme';
import type { ImageSource, ScoredResult } from '../shared/types';

type SortMode = 'similarity' | 'newest' | 'filename';

export function Dashboard() {
  // State
  const [sourceFilter, setSourceFilter] = useState<ImageSource | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('similarity');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme());
  const [totalCount, setTotalCount] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  const [driveCount, setDriveCount] = useState(0);

  // Hooks
  const {
    results,
    isSearching,
    searchStatus,
    queryImage,
    queryName,
    queryText,
    search,
    searchByText,
    clearSearch,
  } = useSearch();

  const {
    progress: indexingProgress,
    setProgress: setIndexingProgress,
    indexLocalFiles,
    indexFromUrls,
    triggerLocalFileSelect,
    triggerFolderSelect,
    handleFileInputChange,
    fileInputRef,
  } = useIndexing();

  const {
    isConnected: isDriveConnected,
    checkConnection: checkDriveConnection,
    connect: connectDrive,
    indexDriveFiles,
    indexDriveFolder,
  } = useGoogleDrive();

  // Refresh counts
  const refreshCounts = useCallback(async () => {
    const [total, local, drive] = await Promise.all([
      getImageCount(),
      getImageCount('local'),
      getImageCount('google-drive'),
    ]);
    setTotalCount(total);
    setLocalCount(local);
    setDriveCount(drive);
  }, []);

  // On mount: refresh counts, check Drive connection, check for pending search
  useEffect(() => {
    refreshCounts();
    checkDriveConnection();

    // Check for pending search from context menu or popup
    // Guard for non-extension contexts (e.g. vite dev mode)
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        chrome.storage.session.get('pendingSearch', async (data) => {
          if (data?.pendingSearch) {
            const { imageUrl, imageDataUrl } = data.pendingSearch;
            chrome.storage.session.remove('pendingSearch');

            if (imageDataUrl) {
              search(imageDataUrl, 'Context Menu Image');
            } else if (imageUrl) {
              // Fetch the image and search
              try {
                const resp = await fetch(imageUrl);
                const blob = await resp.blob();
                const reader = new FileReader();
                reader.onload = () => {
                  search(reader.result as string, imageUrl.split('/').pop() || 'Web Image');
                };
                reader.readAsDataURL(blob);
              } catch (err) {
                console.error('Failed to load context menu image:', err);
              }
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Dashboard] chrome.storage not available:', err);
    }
  }, []);

  // Check for pending folder index (from content script on file:/// pages)
  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        chrome.storage.session.get('pendingFolderIndex', async (data) => {
          if (data?.pendingFolderIndex) {
            const { imageUrls, folderPath } = data.pendingFolderIndex;
            chrome.storage.session.remove('pendingFolderIndex');

            if (imageUrls && imageUrls.length > 0) {
              console.log(`[Dashboard] Auto-indexing ${imageUrls.length} images from folder: ${folderPath}`);
              indexFromUrls(imageUrls, folderPath);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to check pending folder index:', err);
    }
  }, [indexFromUrls]);

  // Refresh counts when indexing completes
  useEffect(() => {
    if (indexingProgress.status === 'complete') {
      refreshCounts();
    }
  }, [indexingProgress.status, refreshCounts]);

  // Handle paste events globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              search(reader.result as string, 'Pasted Image');
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [search]);

  // Search handler from SearchBar
  const handleImageSelected = useCallback(
    (dataUrl: string, name: string) => {
      search(dataUrl, name, sourceFilter);
    },
    [search, sourceFilter]
  );

  // Text search handler
  const handleTextSearch = useCallback(
    (query: string) => {
      searchByText(query, sourceFilter);
    },
    [searchByText, sourceFilter]
  );

  // "Find more like this" — always create a fresh data URL from the blob
  // to avoid using potentially-revoked object URLs
  const handleFindMore = useCallback(
    (result: ScoredResult) => {
      if (result.image.thumbnailBlob) {
        const reader = new FileReader();
        reader.onload = () => {
          search(reader.result as string, result.image.filename, sourceFilter);
        };
        reader.readAsDataURL(result.image.thumbnailBlob);
      } else if (result.thumbnailObjectUrl) {
        // Fallback to object URL if no blob available
        search(result.thumbnailObjectUrl, result.image.filename, sourceFilter);
      }
    },
    [search, sourceFilter]
  );

  // Re-search when filter changes (if we have a query)
  const handleSourceFilterChange = useCallback(
    (source: ImageSource | 'all') => {
      setSourceFilter(source);
      if (queryImage) {
        search(queryImage, queryName, source);
      }
    },
    [queryImage, queryName, search]
  );

  // Drive folder link handler
  const handleDriveFolderLink = useCallback(async (folderLink: string) => {
    await indexDriveFolder(folderLink, (p) => {
      setIndexingProgress(p);
      if (p.status === 'complete') {
        refreshCounts();
        setTimeout(() => {
          setIndexingProgress({ status: 'idle', current: 0, total: 0, errors: [], source: 'google-drive' });
        }, 3000);
      }
    });
  }, [indexDriveFolder, setIndexingProgress, refreshCounts]);

  // Clear index
  const handleClearIndex = useCallback(async () => {
    if (!confirm('Are you sure you want to clear the entire index? This cannot be undone.')) return;
    await clearImages();
    await refreshCounts();
    clearSearch();
  }, [refreshCounts, clearSearch]);

  // Rebuild index (clear and re-prompt)
  const handleRebuildIndex = useCallback(async () => {
    if (!confirm('This will clear all indexed images. You will need to re-add them. Continue?')) return;
    await clearImages();
    await refreshCounts();
    clearSearch();
  }, [refreshCounts, clearSearch]);

  // Sort results
  const sortedResults = React.useMemo(() => {
    const sorted = [...results];
    switch (sortMode) {
      case 'similarity':
        sorted.sort((a, b) => b.score - a.score);
        break;
      case 'newest':
        sorted.sort((a, b) => b.image.indexedAt - a.image.indexedAt);
        break;
      case 'filename':
        sorted.sort((a, b) => a.image.filename.localeCompare(b.image.filename));
        break;
    }
    return sorted;
  }, [results, sortMode]);

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️';

  return (
    <div className="dashboard">
      {/* Top Bar */}
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <div className="dashboard-logo">🔍</div>
          <h1 className="dashboard-title">Image Similarity Search</h1>
        </div>
        <div className="dashboard-topbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
              setTheme(next);
              saveTheme(next);
              applyTheme(next);
            }}
          >
            {themeIcon}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Search Area */}
      {!queryImage && !queryText ? (
        <SearchBar
          onImageSelected={handleImageSelected}
          onTextSearch={handleTextSearch}
          onScanFolder={triggerFolderSelect}
          onDrivePickerOpen={() => alert('Use the "Add Drive Folder" button in the sidebar to paste a Google Drive folder link.')}
          isDriveConnected={isDriveConnected}
        />
      ) : queryImage ? (
        <div className="search-area">
          <div className="search-area-inner">
            <QueryPreview
              imageDataUrl={queryImage}
              filename={queryName}
              status={searchStatus}
              onClear={clearSearch}
            />
          </div>
        </div>
      ) : (
        <div className="search-area">
          <div className="search-area-inner">
            <div className="text-query-preview">
              <div className="text-query-preview-icon">✍️</div>
              <div className="text-query-preview-info">
                <div className="text-query-preview-label">Text Search</div>
                <div className="text-query-preview-query">"{queryText}"</div>
                <div className="text-query-preview-status">{searchStatus}</div>
              </div>
              <button className="btn btn-ghost" onClick={clearSearch}>✕ Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Indexing Progress */}
      {indexingProgress.status !== 'idle' && (
        <div style={{ padding: '0 24px', marginTop: '-8px' }}>
          <IndexingProgress progress={indexingProgress} />
        </div>
      )}

      {/* Main Layout */}
      <div className="dashboard-main">
        {/* Sidebar */}
        <SourceSidebar
          sourceFilter={sourceFilter}
          onSourceFilterChange={handleSourceFilterChange}
          totalCount={totalCount}
          localCount={localCount}
          driveCount={driveCount}
          onAddLocal={triggerLocalFileSelect}
          onAddFolder={triggerFolderSelect}
          onAddDriveFolder={handleDriveFolderLink}
          onRebuildIndex={handleRebuildIndex}
          onClearIndex={handleClearIndex}
        />

        {/* Content */}
        <main className="content">
          {/* Controls Bar */}
          {results.length > 0 && (
            <div className="controls-bar">
              <div className="controls-left">
                Showing {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
              </div>
              <div className="controls-right">
                <label htmlFor="sort-select" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                >
                  <option value="similarity">Most Similar</option>
                  <option value="newest">Newest First</option>
                  <option value="filename">Filename</option>
                </select>
              </div>
            </div>
          )}

          {/* Results or Empty State */}
          {isSearching ? (
            <SkeletonGrid />
          ) : sortedResults.length > 0 ? (
            <ResultsGrid results={sortedResults} onFindMore={handleFindMore} />
          ) : (
            <EmptyState
              hasIndex={totalCount > 0}
              hasQuery={!!queryImage || !!queryText}
              onAddImages={triggerLocalFileSelect}
              onScanFolder={triggerFolderSelect}
            />
          )}
        </main>
      </div>

      {/* Hidden file input for indexing */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Settings Modal */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
