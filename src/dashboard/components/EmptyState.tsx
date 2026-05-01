import React from 'react';

interface EmptyStateProps {
  hasIndex: boolean;
  hasQuery: boolean;
  onAddImages: () => void;
}

export function EmptyState({ hasIndex, hasQuery, onAddImages }: EmptyStateProps) {
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
          Use the sidebar to add local images or connect Google Drive.
        </div>
        <button className="btn btn-primary" onClick={onAddImages}>
          ➕ Add Images to Index
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">🖼️</div>
      <div className="empty-state-title">Find Visually Similar Images</div>
      <div className="empty-state-text">
        Upload a query image above to search your indexed collection.
        Start by adding images to your index using the sidebar controls,
        then search to find visually similar matches ranked by AI similarity score.
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button className="btn btn-primary" onClick={onAddImages}>
          ➕ Add Images
        </button>
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
