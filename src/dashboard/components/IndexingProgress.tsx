import React from 'react';
import type { IndexingProgress as IIndexingProgress } from '../../shared/types';

interface IndexingProgressProps {
  progress: IIndexingProgress;
}

export function IndexingProgress({ progress }: IndexingProgressProps) {
  const { status, current, total, errors, source } = progress;

  if (status === 'idle') return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const sourceLabel = source === 'google-drive' ? 'Google Drive' : 'local';

  const statusMessages: Record<string, string> = {
    'loading-model': 'Loading AI model...',
    'indexing': `Indexing ${sourceLabel} images...`,
    'complete': `Indexing complete!`,
    'error': 'Indexing failed',
  };

  return (
    <div className="indexing-progress">
      <div className="indexing-progress-header">
        <div className="indexing-progress-title">
          {status === 'loading-model' && '🧠 '}
          {status === 'indexing' && '⚡ '}
          {status === 'complete' && '✅ '}
          {status === 'error' && '❌ '}
          {statusMessages[status] || status}
        </div>
        <div className="indexing-progress-count">
          {current} / {total}
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>

      {errors.length > 0 && (
        <div className="indexing-progress-errors">
          <strong>{errors.length} error(s):</strong>
          <ul style={{ margin: '4px 0 0 16px', fontSize: '12px' }}>
            {errors.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
