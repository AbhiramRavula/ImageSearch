import React from 'react';
import type { ImageSource } from '../../shared/types';

interface SourceSidebarProps {
  sourceFilter: ImageSource | 'all';
  onSourceFilterChange: (source: ImageSource | 'all') => void;
  totalCount: number;
  localCount: number;
  driveCount: number;
  onAddLocal: () => void;
  onAddDrive: () => void;
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
  onAddDrive,
  onRebuildIndex,
  onClearIndex,
}: SourceSidebarProps) {
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
        <button className="sidebar-action-btn" onClick={onAddDrive}>
          <span>☁️</span>
          <span>Add from Drive</span>
        </button>
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
