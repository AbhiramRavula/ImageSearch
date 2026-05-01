import React, { useState } from 'react';
import type { ImageSource } from '../../shared/types';

interface SourceSidebarProps {
  sourceFilter: ImageSource | 'all';
  onSourceFilterChange: (source: ImageSource | 'all') => void;
  totalCount: number;
  localCount: number;
  driveCount: number;
  onAddLocal: () => void;
  onAddFolder: () => void;
  onAddDriveFolder: (folderLink: string) => void;
  onRebuildIndex: () => void;
  onClearIndex: () => void;
}

export function SourceSidebar({
  sourceFilter,
  onSourceFilterChange,
  totalCount,
  localCount,
  driveCount,
  onAddLocal,
  onAddFolder,
  onAddDriveFolder,
  onRebuildIndex,
  onClearIndex,
}: SourceSidebarProps) {
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [showDriveInput, setShowDriveInput] = useState(false);

  const handleDriveFolderSubmit = () => {
    if (!driveFolderLink.trim()) return;
    onAddDriveFolder(driveFolderLink.trim());
    setDriveFolderLink('');
    setShowDriveInput(false);
  };

  return (
    <aside className="sidebar">
      {/* Index Stats */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Index Stats</div>
        <div className="sidebar-index-stats">
          <div className="sidebar-stat-card">
            <div className="sidebar-stat-value">{totalCount}</div>
            <div className="sidebar-stat-label">Total</div>
          </div>
          <div className="sidebar-stat-card">
            <div className="sidebar-stat-value">{localCount}</div>
            <div className="sidebar-stat-label">Local</div>
          </div>
        </div>
        <div className="sidebar-index-stats">
          <div className="sidebar-stat-card">
            <div className="sidebar-stat-value">{driveCount}</div>
            <div className="sidebar-stat-label">Drive</div>
          </div>
          <div className="sidebar-stat-card">
            <div className="sidebar-stat-value">
              {totalCount > 0 ? '✓' : '—'}
            </div>
            <div className="sidebar-stat-label">Status</div>
          </div>
        </div>
      </div>

      {/* Source Filters */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Sources</div>
        <button
          className={`sidebar-filter-btn ${sourceFilter === 'all' ? 'active' : ''}`}
          onClick={() => onSourceFilterChange('all')}
        >
          <span>🌐</span>
          <span>All Sources</span>
          <span className="sidebar-filter-count">{totalCount}</span>
        </button>
        <button
          className={`sidebar-filter-btn ${sourceFilter === 'local' ? 'active' : ''}`}
          onClick={() => onSourceFilterChange('local')}
        >
          <span>💾</span>
          <span>Local Files</span>
          <span className="sidebar-filter-count">{localCount}</span>
        </button>
        <button
          className={`sidebar-filter-btn ${sourceFilter === 'google-drive' ? 'active' : ''}`}
          onClick={() => onSourceFilterChange('google-drive')}
        >
          <span>☁️</span>
          <span>Google Drive</span>
          <span className="sidebar-filter-count">{driveCount}</span>
        </button>
      </div>

      {/* Indexing Actions */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Index Images</div>
        <button className="sidebar-action-btn" onClick={onAddLocal}>
          <span>➕</span>
          <span>Add Local Images</span>
        </button>
        <button className="sidebar-action-btn" onClick={onAddFolder}>
          <span>📂</span>
          <span>Add Folder</span>
        </button>

        {/* Drive Folder Link */}
        <button
          className="sidebar-action-btn"
          onClick={() => setShowDriveInput(!showDriveInput)}
          style={showDriveInput ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : {}}
        >
          <span>☁️</span>
          <span>Add Drive Folder</span>
        </button>

        {showDriveInput && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)',
            animation: 'scaleIn 0.2s ease',
          }}>
            <input
              type="text"
              placeholder="Paste Drive folder link..."
              value={driveFolderLink}
              onChange={(e) => setDriveFolderLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDriveFolderSubmit(); }}
              style={{
                fontSize: 'var(--font-size-sm)',
                padding: 'var(--space-2)',
                width: '100%',
              }}
            />
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              Paste a link like:<br />
              drive.google.com/drive/folders/...
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDriveFolderSubmit}
              disabled={!driveFolderLink.trim()}
              style={{ width: '100%' }}
            >
              Index Folder
            </button>
          </div>
        )}

        <button className="sidebar-action-btn" onClick={onRebuildIndex}>
          <span>🔄</span>
          <span>Rebuild Index</span>
        </button>
        <button
          className="sidebar-action-btn"
          onClick={onClearIndex}
          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
        >
          <span>🗑️</span>
          <span>Clear Index</span>
        </button>
      </div>
    </aside>
  );
}
