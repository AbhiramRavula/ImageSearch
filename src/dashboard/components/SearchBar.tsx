import React, { useCallback, useRef, useState } from 'react';
import { fileToDataUrl } from '../../shared/utils/image-processing';

type SearchMode = 'image' | 'text';

interface SearchBarProps {
  onImageSelected: (dataUrl: string, name: string) => void;
  onTextSearch: (query: string) => void;
  onScanFolder: () => void;
  onDrivePickerOpen: () => void;
  isDriveConnected: boolean;
}

export function SearchBar({
  onImageSelected,
  onTextSearch,
  onScanFolder,
  onDrivePickerOpen,
  isDriveConnected,
}: SearchBarProps) {
  const [mode, setMode] = useState<SearchMode>('image');
  const [isDragOver, setIsDragOver] = useState(false);
  const [textQuery, setTextQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await fileToDataUrl(file);
    onImageSelected(dataUrl, file.name);
  }, [onImageSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'pasted-image.png', { type: imageType });
          handleFile(file);
          return;
        }
      }
    } catch {
      console.warn('Clipboard read failed — use Ctrl+V instead');
    }
  }, [handleFile]);

  const handleTextSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (textQuery.trim()) {
      onTextSearch(textQuery.trim());
    }
  }, [textQuery, onTextSearch]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && textQuery.trim()) {
      onTextSearch(textQuery.trim());
    }
  }, [textQuery, onTextSearch]);

  return (
    <div className="search-area">
      <div className="search-area-inner">
        {/* Mode Tabs */}
        <div className="search-tabs">
          <button
            className={`search-tab ${mode === 'image' ? 'active' : ''}`}
            onClick={() => setMode('image')}
          >
            🖼️ Search by Image
          </button>
          <button
            className={`search-tab ${mode === 'text' ? 'active' : ''}`}
            onClick={() => setMode('text')}
          >
            ✍️ Search by Text
          </button>
        </div>

        {/* Image Search Mode */}
        {mode === 'image' && (
          <div
            className={`drop-zone search-dropzone ${isDragOver ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="search-dropzone-icon">
              {isDragOver ? '📥' : '🔍'}
            </div>
            <div className="search-dropzone-title">
              {isDragOver ? 'Drop your image here' : 'Drop a reference image'}
            </div>
            <div className="search-dropzone-subtitle">
              Drag & drop an image, <strong>click to browse</strong>, or paste from clipboard
            </div>
            <div className="search-dropzone-buttons">
              <button
                className="btn btn-primary"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                📁 Browse Files
              </button>
              <button
                className="btn btn-secondary"
                onClick={(e) => { e.stopPropagation(); handlePaste(); }}
              >
                📋 Paste
              </button>
            </div>
            <div className="search-dropzone-hint">
              Supports JPEG, PNG, WebP, GIF, BMP • Max 50MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Text Search Mode */}
        {mode === 'text' && (
          <div className="text-search-area">
            <div className="text-search-icon">✍️</div>
            <div className="text-search-title">Describe what you're looking for</div>
            <div className="text-search-subtitle">
              Search by AI-detected content (e.g. <em>"dog"</em>, <em>"car"</em>, <em>"beach"</em>) or filename
            </div>
            <form className="text-search-form" onSubmit={handleTextSubmit}>
              <div className="text-search-input-wrapper">
                <span className="text-search-input-icon">🔎</span>
                <input
                  type="text"
                  className="text-search-input"
                  placeholder='Try "dog", "mountain", "sunset", or a filename...'
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  autoFocus
                />
                {textQuery && (
                  <button
                    type="button"
                    className="text-search-clear"
                    onClick={() => setTextQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary text-search-submit"
                disabled={!textQuery.trim()}
              >
                Search
              </button>
            </form>
            <div className="text-search-hint">
              Images are auto-tagged with AI labels during indexing — search matches tags + filenames
            </div>
          </div>
        )}

        {/* Quick Action: Scan Folder */}
        <div className="search-quick-actions">
          <button className="btn btn-accent search-scan-btn" onClick={onScanFolder}>
            📂 Scan a Local Folder
          </button>
          <span className="search-quick-divider">or browse folder in Chrome at <code>file:///C:/path/to/photos/</code></span>
        </div>
      </div>
    </div>
  );
}
