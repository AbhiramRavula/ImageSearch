// ── Chrome extension message type definitions ──

import type { ImageSource, ScoredResult, IndexingProgress } from './types';

/** All message types exchanged between extension contexts */
export type ExtensionMessage =
  | SearchImageMessage
  | SearchResultsMessage
  | IndexLocalImagesMessage
  | IndexDriveImagesMessage
  | IndexingProgressMessage
  | GetAuthTokenMessage
  | AuthTokenResultMessage
  | GetIndexStatsMessage
  | IndexStatsResultMessage
  | ClearIndexMessage
  | RebuildIndexMessage
  | OpenDashboardMessage
  | ContextMenuSearchMessage;

// ── Search ──
export interface SearchImageMessage {
  type: 'SEARCH_IMAGE';
  payload: {
    imageDataUrl: string;
    sourceFilter?: ImageSource | 'all';
    maxResults?: number;
  };
}

export interface SearchResultsMessage {
  type: 'SEARCH_RESULTS';
  payload: {
    results: ScoredResult[];
    queryTime: number;
  };
}

// ── Indexing ──
export interface IndexLocalImagesMessage {
  type: 'INDEX_LOCAL_IMAGES';
  payload: {
    files: Array<{
      name: string;
      dataUrl: string;
      size: number;
      type: string;
      lastModified: number;
    }>;
  };
}

export interface IndexDriveImagesMessage {
  type: 'INDEX_DRIVE_IMAGES';
  payload: {
    fileIds: string[];
  };
}

export interface IndexingProgressMessage {
  type: 'INDEXING_PROGRESS';
  payload: IndexingProgress;
}

// ── Auth ──
export interface GetAuthTokenMessage {
  type: 'GET_AUTH_TOKEN';
}

export interface AuthTokenResultMessage {
  type: 'AUTH_TOKEN_RESULT';
  payload: {
    token?: string;
    error?: string;
  };
}

// ── Index Management ──
export interface GetIndexStatsMessage {
  type: 'GET_INDEX_STATS';
}

export interface IndexStatsResultMessage {
  type: 'INDEX_STATS_RESULT';
  payload: {
    totalImages: number;
    localImages: number;
    driveImages: number;
    storageUsed: number;
  };
}

export interface ClearIndexMessage {
  type: 'CLEAR_INDEX';
  payload?: {
    source?: ImageSource;
  };
}

export interface RebuildIndexMessage {
  type: 'REBUILD_INDEX';
  payload?: {
    source?: ImageSource;
  };
}

// ── Navigation ──
export interface OpenDashboardMessage {
  type: 'OPEN_DASHBOARD';
  payload?: {
    queryImageDataUrl?: string;
  };
}

export interface ContextMenuSearchMessage {
  type: 'CONTEXT_MENU_SEARCH';
  payload: {
    imageUrl: string;
    pageUrl: string;
  };
}
