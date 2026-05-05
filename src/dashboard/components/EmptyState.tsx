import React from 'react';

interface EmptyStateProps {
  hasIndex: boolean;
  hasQuery: boolean;
  onAddImages: () => void;
  onScanFolder: () => void;
}

export function EmptyState({ hasIndex, hasQuery, onAddImages, onScanFolder }: EmptyStateProps) {
  if (hasQuery && hasIndex) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">No Similar Images Found</div>
        <div className="empty-state-text">
          Your query didn't match any indexed images closely enough.
          Try a different image or add more images to your index.
        </div>
      </div>
    );
  }

  if (hasQuery && !hasIndex) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📂</div>
        <div className="empty-state-title">No Images Indexed Yet</div>
        <div className="empty-state-text">
          You need to index some images before searching.
          Scan a folder to get started — all your photos will be analyzed by AI.
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={onScanFolder}>
            📂 Scan a Folder
          </button>
          <button className="btn btn-secondary" onClick={onAddImages}>
            ➕ Add Individual Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">🖼️</div>
      <div className="empty-state-title">Find Any Photo Instantly</div>
      <div className="empty-state-text">
        <strong>Step 1:</strong> Scan a folder of photos — the AI will analyze and index every image.
        <br />
        <strong>Step 2:</strong> Search by dropping a reference image or typing what you're looking for.
        <br />
        <strong>Step 3:</strong> Get ranked results showing the most similar photos.
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-lg" onClick={onScanFolder}>
          📂 Scan a Folder to Start
        </button>
        <button className="btn btn-secondary" onClick={onAddImages}>
          ➕ Add Individual Files
        </button>
      </div>
      <div className="empty-state-hint">
        💡 Tip: You can also open a folder in Chrome (<code>file:///C:/photos/</code>) and the extension will detect your images automatically.
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-card-image" />
          <div className="skeleton-card-text">
            <div className="skeleton skeleton-line w-75" />
            <div className="skeleton skeleton-line w-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
