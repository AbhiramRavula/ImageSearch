// ── Content script ──
// Injected into all pages to support right-click "Search similar images" context menu.
// Listens for messages from the background service worker.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_IMAGE_DATA') {
    // The background script may ask us to fetch image data from the page
    const imageUrl = message.payload?.imageUrl;
    if (!imageUrl) {
      sendResponse({ error: 'No image URL provided' });
      return;
    }

    // Try to find the image element on the page and extract its data
    fetchImageAsDataUrl(imageUrl)
      .then((dataUrl) => {
        sendResponse({ dataUrl });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });

    return true; // Keep channel open for async response
  }
});

/** Fetch an image URL and convert to data URL using canvas */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
      } catch (err) {
        // CORS issue — try fetching the image as a blob instead
        fetchImageViaBlob(url).then(resolve).catch(reject);
      }
    };
    img.onerror = () => {
      fetchImageViaBlob(url).then(resolve).catch(reject);
    };
    img.src = url;
  });
}

/** Fallback: fetch image as blob and convert to data URL */
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
