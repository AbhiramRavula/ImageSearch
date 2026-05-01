import React from 'react';

interface QueryPreviewProps {
  imageDataUrl: string;
  filename: string;
  status: string;
  onClear: () => void;
}

export function QueryPreview({ imageDataUrl, filename, status, onClear }: QueryPreviewProps) {
  return (
    <div className="query-preview">
      <img className="query-preview-image" src={imageDataUrl} alt="Query" />
      <div className="query-preview-info">
        <div className="query-preview-name">{filename || 'Query Image'}</div>
        <div className="query-preview-status">
          {status.includes('Loading') || status.includes('Analyzing') || status.includes('Searching') ? (
            <>
              <span className="popup-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span>{status}</span>
            </>
          ) : (
            <span>{status}</span>
          )}
        </div>
      </div>
      <div className="query-preview-actions">
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          ✕ Clear
        </button>
      </div>
    </div>
  );
}
