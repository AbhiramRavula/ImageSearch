// ── Content script ──
// Injected into all pages.
// Features:
//   1. Right-click "Search similar images" context menu support
//   2. Auto-detect file:/// folder pages → inject ImgSearch panel

// ── Image file extensions ──
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
  'tiff', 'tif', 'ico', 'avif', 'heic', 'heif',
]);

// ══════════════════════════════════════════════
// 1. Message listener (for context menu support)
// ══════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_IMAGE_DATA') {
    const imageUrl = message.payload?.imageUrl;
    if (!imageUrl) {
      sendResponse({ error: 'No image URL provided' });
      return;
    }

    fetchImageAsDataUrl(imageUrl)
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((err) => sendResponse({ error: err.message }));

    return true; // Keep channel open for async response
  }
});

/** Fetch an image URL and convert to data URL using canvas */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Don't set crossOrigin for file:// URLs
    if (!url.startsWith('file:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch {
        fetchImageViaBlob(url).then(resolve).catch(reject);
      }
    };
    img.onerror = () => {
      fetchImageViaBlob(url).then(resolve).catch(reject);
    };
    img.src = url;
  });
}

async function fetchImageViaBlob(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

// ══════════════════════════════════════════════
// 2. File:/// folder detection & ImgSearch panel
// ══════════════════════════════════════════════

function isFileProtocol(): boolean {
  return location.protocol === 'file:';
}

function isDirectoryListing(): boolean {
  // Chrome's directory listing pages have a title starting with "Index of"
  // and contain a table or list of file links
  const title = document.title;
  if (title.startsWith('Index of')) return true;

  // Fallback: look for multiple <a> tags pointing to files
  const links = document.querySelectorAll('a[href]');
  let imageCount = 0;
  links.forEach((a) => {
    const href = (a as HTMLAnchorElement).getAttribute('href') || '';
    const ext = href.split('.').pop()?.toLowerCase().split('?')[0] || '';
    if (IMAGE_EXTENSIONS.has(ext)) imageCount++;
  });
  return imageCount >= 2;
}

function collectImageUrls(): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const links = document.querySelectorAll('a[href]');

  links.forEach((a) => {
    const href = (a as HTMLAnchorElement).getAttribute('href') || '';
    const ext = href.split('.').pop()?.toLowerCase().split('?')[0] || '';
    if (!IMAGE_EXTENSIONS.has(ext)) return;

    // Resolve relative URL to absolute
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, location.href).href;
    } catch {
      return;
    }

    if (!seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      urls.push(absoluteUrl);
    }
  });

  return urls;
}

function getFolderPath(): string {
  // Extract a readable folder path from the current URL
  const url = location.href;
  try {
    // file:///C:/Users/photos/ → C:/Users/photos/
    return decodeURIComponent(url.replace('file:///', '').replace(/\/$/, ''));
  } catch {
    return url;
  }
}

// ── Panel injection ──

function injectPanel(imageUrls: string[]) {
  // Don't inject twice
  if (document.getElementById('imgsearch-panel')) return;

  const folderPath = getFolderPath();
  const count = imageUrls.length;

  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'imgsearch-panel';
  panel.innerHTML = `
    <style>
      #imgsearch-panel {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #e8eaf0;
        pointer-events: auto;
      }
      #imgsearch-panel * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .imgsearch-card {
        background: linear-gradient(135deg, #1c1f2e 0%, #252839 100%);
        border: 1px solid rgba(129, 140, 248, 0.25);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(99, 102, 241, 0.1);
        backdrop-filter: blur(20px);
        width: 340px;
        overflow: hidden;
        transition: all 0.3s ease;
        animation: imgsearch-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .imgsearch-card:hover {
        box-shadow: 0 24px 48px rgba(0,0,0,0.5), 0 0 40px rgba(99, 102, 241, 0.15);
        border-color: rgba(129, 140, 248, 0.4);
      }
      @keyframes imgsearch-slideIn {
        from { transform: translateY(20px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      .imgsearch-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(129, 140, 248, 0.12);
        background: rgba(99, 102, 241, 0.06);
      }
      .imgsearch-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .imgsearch-logo {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
      }
      .imgsearch-title {
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #818cf8, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .imgsearch-close {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #6b7094;
        font-size: 14px;
        transition: all 0.15s;
        border: none;
        background: none;
      }
      .imgsearch-close:hover {
        background: rgba(255,255,255,0.08);
        color: #e8eaf0;
      }
      .imgsearch-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .imgsearch-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(99, 102, 241, 0.08);
        border-radius: 10px;
        border: 1px solid rgba(99, 102, 241, 0.12);
      }
      .imgsearch-stats-icon {
        font-size: 22px;
      }
      .imgsearch-stats-info {
        flex: 1;
      }
      .imgsearch-stats-count {
        font-size: 18px;
        font-weight: 700;
        color: #818cf8;
      }
      .imgsearch-stats-label {
        font-size: 11px;
        color: #6b7094;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .imgsearch-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-family: inherit;
        width: 100%;
      }
      .imgsearch-btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      .imgsearch-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      }
      .imgsearch-btn-primary:active {
        transform: translateY(0);
      }
      .imgsearch-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .imgsearch-btn-secondary {
        background: rgba(255,255,255,0.06);
        color: #9ca0b8;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .imgsearch-btn-secondary:hover {
        background: rgba(255,255,255,0.1);
        color: #e8eaf0;
        border-color: rgba(255,255,255,0.15);
      }
      .imgsearch-btns {
        display: flex;
        gap: 8px;
      }
      .imgsearch-dropzone {
        border: 2px dashed rgba(129, 140, 248, 0.25);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: rgba(99, 102, 241, 0.04);
      }
      .imgsearch-dropzone:hover,
      .imgsearch-dropzone.active {
        border-color: rgba(129, 140, 248, 0.5);
        background: rgba(99, 102, 241, 0.1);
      }
      .imgsearch-dropzone-icon {
        font-size: 24px;
        margin-bottom: 4px;
      }
      .imgsearch-dropzone-text {
        font-size: 12px;
        color: #9ca0b8;
      }
      .imgsearch-dropzone-text strong {
        color: #818cf8;
      }
      .imgsearch-folder {
        font-size: 11px;
        color: #6b7094;
        padding: 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .imgsearch-progress {
        display: none;
        flex-direction: column;
        gap: 6px;
      }
      .imgsearch-progress.visible {
        display: flex;
      }
      .imgsearch-progress-bar {
        height: 4px;
        background: rgba(255,255,255,0.06);
        border-radius: 4px;
        overflow: hidden;
      }
      .imgsearch-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }
      .imgsearch-progress-text {
        font-size: 11px;
        color: #9ca0b8;
        text-align: center;
      }
      .imgsearch-minimized {
        display: none;
        cursor: pointer;
      }
      .imgsearch-minimized.visible {
        display: flex;
      }
      .imgsearch-fab {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        transition: all 0.2s;
        border: none;
      }
      .imgsearch-fab:hover {
        transform: scale(1.05);
        box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5);
      }
    </style>

    <!-- Expanded panel -->
    <div class="imgsearch-card" id="imgsearch-expanded">
      <div class="imgsearch-header">
        <div class="imgsearch-brand">
          <div class="imgsearch-logo">🔍</div>
          <span class="imgsearch-title">ImgSearch</span>
        </div>
        <button class="imgsearch-close" id="imgsearch-minimize" title="Minimize">─</button>
      </div>
      <div class="imgsearch-body">
        <div class="imgsearch-stats">
          <div class="imgsearch-stats-icon">📷</div>
          <div class="imgsearch-stats-info">
            <div class="imgsearch-stats-count">${count}</div>
            <div class="imgsearch-stats-label">images found</div>
          </div>
        </div>

        <div class="imgsearch-folder" title="${folderPath}">📂 ${folderPath}</div>

        <div class="imgsearch-btns">
          <button class="imgsearch-btn imgsearch-btn-primary" id="imgsearch-index-btn">
            ⚡ Index All
          </button>
          <button class="imgsearch-btn imgsearch-btn-secondary" id="imgsearch-dashboard-btn">
            Dashboard →
          </button>
        </div>

        <div class="imgsearch-progress" id="imgsearch-progress">
          <div class="imgsearch-progress-bar">
            <div class="imgsearch-progress-fill" id="imgsearch-progress-fill"></div>
          </div>
          <div class="imgsearch-progress-text" id="imgsearch-progress-text">Sending to dashboard...</div>
        </div>

        <div class="imgsearch-dropzone" id="imgsearch-dropzone">
          <div class="imgsearch-dropzone-icon">🔎</div>
          <div class="imgsearch-dropzone-text">
            <strong>Drop</strong> or <strong>click</strong> to search by image
          </div>
        </div>
      </div>
    </div>

    <!-- Minimized FAB -->
    <div class="imgsearch-minimized" id="imgsearch-minimized">
      <button class="imgsearch-fab" id="imgsearch-fab" title="ImgSearch: ${count} images">🔍</button>
    </div>
  `;

  document.body.appendChild(panel);

  // ── Wire up events ──
  const expandedEl = panel.querySelector('#imgsearch-expanded') as HTMLElement;
  const minimizedEl = panel.querySelector('#imgsearch-minimized') as HTMLElement;
  const minimizeBtn = panel.querySelector('#imgsearch-minimize') as HTMLElement;
  const fabBtn = panel.querySelector('#imgsearch-fab') as HTMLElement;
  const indexBtn = panel.querySelector('#imgsearch-index-btn') as HTMLButtonElement;
  const dashboardBtn = panel.querySelector('#imgsearch-dashboard-btn') as HTMLElement;
  const dropzone = panel.querySelector('#imgsearch-dropzone') as HTMLElement;
  const progressEl = panel.querySelector('#imgsearch-progress') as HTMLElement;
  const progressFill = panel.querySelector('#imgsearch-progress-fill') as HTMLElement;
  const progressText = panel.querySelector('#imgsearch-progress-text') as HTMLElement;

  // Minimize / expand
  minimizeBtn.addEventListener('click', () => {
    expandedEl.style.display = 'none';
    minimizedEl.classList.add('visible');
  });

  fabBtn.addEventListener('click', () => {
    expandedEl.style.display = '';
    minimizedEl.classList.remove('visible');
  });

  // Index All button
  indexBtn.addEventListener('click', () => {
    indexBtn.disabled = true;
    indexBtn.textContent = '⏳ Sending...';
    progressEl.classList.add('visible');
    progressFill.style.width = '30%';
    progressText.textContent = `Sending ${count} image URLs to dashboard...`;

    chrome.runtime.sendMessage(
      {
        type: 'INDEX_FOLDER',
        payload: { imageUrls, folderPath },
      },
      (response) => {
        if (response?.success) {
          progressFill.style.width = '100%';
          progressText.textContent = '✅ Dashboard opened — indexing in progress!';
          indexBtn.textContent = '✅ Sent!';
        } else {
          progressText.textContent = '❌ Failed to send. Try again.';
          indexBtn.disabled = false;
          indexBtn.textContent = '⚡ Index All';
        }
      }
    );
  });

  // Dashboard button
  dashboardBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  // Search dropzone — click to browse
  const searchInput = document.createElement('input');
  searchInput.type = 'file';
  searchInput.accept = 'image/*';
  searchInput.style.display = 'none';
  panel.appendChild(searchInput);

  dropzone.addEventListener('click', () => searchInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('active');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('active');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('active');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      sendSearchImage(file);
    }
  });

  searchInput.addEventListener('change', () => {
    const file = searchInput.files?.[0];
    if (file) sendSearchImage(file);
    searchInput.value = '';
  });
}

/** Convert a file to data URL and send to dashboard for searching */
function sendSearchImage(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    chrome.runtime.sendMessage({
      type: 'OPEN_DASHBOARD',
      payload: { queryImageDataUrl: dataUrl },
    });
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════
// 3. Initialize on page load
// ══════════════════════════════════════════════

function init() {
  if (!isFileProtocol()) return;
  if (!isDirectoryListing()) return;

  const imageUrls = collectImageUrls();
  if (imageUrls.length === 0) return;

  console.log(`[ImgSearch] Detected ${imageUrls.length} images in local folder`);
  injectPanel(imageUrls);
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
