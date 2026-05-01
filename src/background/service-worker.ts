// ── Background service worker ──
// Handles: context menu, message routing, Google OAuth orchestration

import { CONTEXT_MENU_ID } from '../shared/constants';
import type { ExtensionMessage } from '../shared/messaging';

// ── Context Menu Setup ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Search similar images',
    contexts: ['image'],
  });
  console.log('[ServiceWorker] Context menu registered');
});

// ── Context Menu Click Handler ──
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.srcUrl) return;

  const imageUrl = info.srcUrl;
  const pageUrl = info.pageUrl || tab?.url || '';

  console.log('[ServiceWorker] Context menu search:', imageUrl);

  // Store the image URL and open the dashboard
  chrome.storage.session.set({
    pendingSearch: { imageUrl, pageUrl, timestamp: Date.now() },
  });

  // Open dashboard in a new tab
  const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');
  chrome.tabs.create({ url: `${dashboardUrl}?search=context-menu` });
});

// ── Message Router ──
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true; // Keep the message channel open for async responses
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void
) {
  try {
    switch (message.type) {
      case 'GET_AUTH_TOKEN': {
        try {
          const token = await new Promise<string>((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(token || '');
            });
          });
          sendResponse({ type: 'AUTH_TOKEN_RESULT', payload: { token } });
        } catch (err) {
          sendResponse({
            type: 'AUTH_TOKEN_RESULT',
            payload: { error: (err as Error).message },
          });
        }
        break;
      }

      case 'OPEN_DASHBOARD': {
        const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');
        const queryImageDataUrl = message.payload?.queryImageDataUrl;
        if (queryImageDataUrl) {
          // Store query image in session for the dashboard to pick up
          await chrome.storage.session.set({
            pendingSearch: { imageDataUrl: queryImageDataUrl, timestamp: Date.now() },
          });
        }
        chrome.tabs.create({ url: dashboardUrl });
        sendResponse({ success: true });
        break;
      }

      case 'GET_INDEX_STATS': {
        // Forward to the dashboard or compute here
        // For now, respond with a message that the dashboard should compute this directly
        sendResponse({ type: 'INDEX_STATS_RESULT', payload: null });
        break;
      }

      case 'CONTEXT_MENU_SEARCH': {
        const { imageUrl } = message.payload;
        await chrome.storage.session.set({
          pendingSearch: { imageUrl, timestamp: Date.now() },
        });
        const dashUrl = chrome.runtime.getURL('src/dashboard/index.html');
        chrome.tabs.create({ url: `${dashUrl}?search=context-menu` });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (err) {
    console.error('[ServiceWorker] Message handling error:', err);
    sendResponse({ error: (err as Error).message });
  }
}

console.log('[ServiceWorker] Image Similarity Search service worker loaded');
