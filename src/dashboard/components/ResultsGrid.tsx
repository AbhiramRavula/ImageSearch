import React, { useEffect, useRef, useState } from 'react';
import type { ScoredResult } from '../../shared/types';

interface ResultCardProps {
  result: ScoredResult;
  onFindMore: (result: ScoredResult) => void;
}

export function ResultCard({ result, onFindMore }: ResultCardProps) {
  const { image, score } = result;
  const [thumbnailSrc, setThumbnailSrc] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Lazy load thumbnail via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate object URL for thumbnail blob
  useEffect(() => {
    if (!isVisible) return;

    if (result.thumbnailObjectUrl) {
      setThumbnailSrc(result.thumbnailObjectUrl);
    } else if (image.thumbnailBlob) {
      const url = URL.createObjectURL(image.thumbnailBlob);
      setThumbnailSrc(url);
      return () => URL.revokeObjectURL(url);
    } else if (image.thumbnailUrl) {
      setThumbnailSrc(image.thumbnailUrl);
    }
  }, [isVisible, result, image]);

  const scorePercent = Math.round(score * 100);
  const scoreClass = scorePercent >= 80 ? '' : scorePercent >= 50 ? 'mid' : 'low';

  const dimensions = image.width && image.height
    ? `${image.width}×${image.height}`
    : undefined;

  return (
    <div className="card card-interactive result-card" ref={cardRef}>
      <div className="result-card-image-wrap">
        {isVisible && thumbnailSrc ? (
          <img
            className="result-card-image"
            src={thumbnailSrc}
            alt={image.filename}
            loading="lazy"
          />
        ) : (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        )}

        {/* Score badge */}
        <div className="result-card-score">
          <span className={`badge-score ${scoreClass}`}>{scorePercent}%</span>
        </div>

        {/* Source badge */}
        <div className="result-card-source">
          <span className={`badge ${image.source === 'local' ? 'badge-local' : 'badge-drive'}`}>
            {image.source === 'local' ? '💾 Local' : '☁️ Drive'}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="result-card-overlay">
          <button
            className="result-card-overlay-btn"
            onClick={(e) => { e.stopPropagation(); onFindMore(result); }}
          >
            Find Similar
          </button>
          {image.source === 'local' && image.thumbnailBlob && (
            <button
              className="result-card-overlay-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (thumbnailSrc) {
                  const a = document.createElement('a');
                  a.href = thumbnailSrc;
                  a.download = image.filename;
                  a.click();
                }
              }}
            >
              Download
            </button>
          )}
        </div>
      </div>

      <div className="result-card-info">
        <div className="result-card-filename" title={image.filename}>
          {image.filename}
        </div>
        <div className="result-card-meta">
          {dimensions && <span>{dimensions}</span>}
          {image.fileSize && (
            <span>
              {image.fileSize < 1024 * 1024
                ? `${(image.fileSize / 1024).toFixed(0)}KB`
                : `${(image.fileSize / (1024 * 1024)).toFixed(1)}MB`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultsGridProps {
  results: ScoredResult[];
  onFindMore: (result: ScoredResult) => void;
}

export function ResultsGrid({ results, onFindMore }: ResultsGridProps) {
  return (
    <div className="results-grid">
      {results.map((r) => (
        <ResultCard key={r.image.id} result={r} onFindMore={onFindMore} />
      ))}
    </div>
  );
}
