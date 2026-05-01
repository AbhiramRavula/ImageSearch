import React, { useCallback, useRef, useState } from 'react';
import { fileToDataUrl } from '../../shared/utils/image-processing';

interface SearchBarProps {
  onImageSelected: (dataUrl: string, name: string) => void;
  onDrivePickerOpen: () => void;
  isDriveConnected: boolean;
}

export function SearchBar({ onImageSelected, onDrivePickerOpen, isDriveConnected }: SearchBarProps) {
  const [isDragOver, setIsDragOver] = useState(false);
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
      // Clipboard API may not be available or permission denied
      console.warn('Clipboard read failed — use Ctrl+V instead');
    }
  }, [handleFile]);

  return (
    <div className="search-area">
      <div className="search-area-inner">
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
            {isDragOver ? 'Drop your image here' : 'Search by image'}
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
            <button
              className="btn btn-secondary"
              onClick={(e) => { e.stopPropagation(); onDrivePickerOpen(); }}
            >
              ☁️ Google Drive
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
      </div>
    </div>
  );
}
