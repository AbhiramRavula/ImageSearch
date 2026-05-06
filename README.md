# Image Similarity Search — Chrome Extension

> AI-powered image search for your local photo collections. Find any photo instantly by dropping a reference image or typing what you're looking for — powered by on-device MobileNet AI.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-MobileNet-orange?logo=tensorflow)
![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen)

## ✨ Key Features

### 🔍 Dual Search Modes
- **Search by Image** — Drop a reference photo to find visually similar matches using AI embeddings
- **Search by Text** — Type what you're looking for (e.g. *"dog"*, *"car"*, *"mountain"*) and AI-detected tags find matching photos

### 📂 Smart Folder Indexing
- **One-Click Folder Scan** — Select any folder from the dashboard and index all images automatically
- **Browser Folder Detection** — Open a local folder in Chrome (`file:///C:/photos/`) and the extension auto-detects images and shows a floating panel to index them
- **Batch Processing** — Handles thousands of photos with progress tracking and duplicate detection

### 🧠 AI-Powered Analysis
- **Visual Embeddings** — 1024-dimensional MobileNet V2 feature vectors for accurate visual similarity
- **Auto-Classification** — Each image is classified with ImageNet labels (e.g. "golden retriever", "sports car", "lakeside") for text search
- **On-Device Processing** — All AI inference runs locally in your browser via TensorFlow.js

### 🛠️ Additional Features
- **🖱️ Right-Click Search** — Right-click any image on the web → "Search similar images"
- **📋 Clipboard Paste** — Paste images directly from clipboard to search
- **☁️ Google Drive Integration** — Connect Google Drive and index cloud images
- **🌗 Theme Support** — Light / Dark / System with smooth transitions
- **🔒 100% Private** — Zero data leaves your browser. No servers, no uploads, no tracking.

## 🚀 Quick Start

### 1. Install & Build

```bash
cd ImgSearch
npm install
npm run build
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **"Load unpacked"** → select the `dist/` folder
4. Click **"Details"** on the extension → enable **"Allow access to file URLs"**

### 3. Start Using

**Option A — Dashboard (recommended):**
1. Click the extension icon → **"Open Dashboard"**
2. Click **"📂 Scan a Folder to Start"**
3. Select your photos folder → AI indexes every image
4. Search by **image** (drag & drop) or **text** (type a description)

**Option B — Browser Folder Detection:**
1. Paste a folder path in Chrome: `file:///C:/Users/you/Pictures/`
2. The extension detects images → a floating panel appears
3. Click **"⚡ Index All"** → Dashboard opens and indexes automatically
4. Search your photos!

**Option C — Right-Click Search:**
1. Right-click any image on any webpage
2. Click **"Search similar images"**
3. Dashboard opens with results from your indexed collection

## 🏗️ Architecture

```
src/
├── popup/                # Compact popup UI (quick search)
├── dashboard/            # Full-page dashboard
│   ├── components/       # SearchBar, ResultsGrid, EmptyState, etc.
│   └── hooks/            # useSearch, useIndexing, useGoogleDrive
├── background/           # Service worker (context menu, message routing)
├── content/              # Content script (folder detection, right-click support)
├── shared/
│   ├── embedding/        # MobileNet engine + cosine similarity
│   ├── storage/          # IndexedDB via Dexie (images + embeddings)
│   ├── google/           # OAuth + Drive API helpers
│   └── utils/            # Image processing, hashing, constants
└── styles/               # CSS design system (light/dark themes)
```

### How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Your Photo  │────▸│  MobileNet   │────▸│  1024-dim    │
│  Collection  │     │  V2 Model    │     │  Embedding   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌──────────────┐              │ Store
                    │  IndexedDB   │◂─────────────┘
                    │  (Dexie.js)  │
                    └──────┬───────┘
                           │ Compare
┌─────────────┐     ┌──────▾───────┐     ┌──────────────┐
│ Query Image  │────▸│   Cosine     │────▸│   Ranked     │
│ or Text      │     │  Similarity  │     │   Results    │
└─────────────┘     └──────────────┘     └──────────────┘
```

1. **Indexing**: Each image → MobileNet V2 → 1024-dim embedding + top-5 classification tags
2. **Storage**: Embeddings are L2-normalized and stored in IndexedDB with metadata + thumbnails
3. **Image Search**: Query image → embed → cosine similarity against all stored vectors → rank
4. **Text Search**: Query text → fuzzy match against AI tags + filenames → rank

### Text Search — AI Tag Examples

| Query | What MobileNet detects |
|-------|----------------------|
| "dog" | golden retriever, labrador, pug, beagle, husky |
| "car" | sports car, minivan, pickup, convertible |
| "cat" | tabby, persian, siamese, egyptian cat |
| "food" | pizza, cheeseburger, ice cream, espresso |
| "flower" | daisy, sunflower, rose hip, pot |
| "bird" | robin, flamingo, pelican, hen |

> **Note**: Text search uses ImageNet's 1000 class labels. It works best for common objects and animals. For more nuanced queries, use image-based search.

## 🔧 Development

```bash
# Start dev server with hot reload
npm run dev

# Type check
npx tsc --noEmit

# Production build
npm run build
```

## ☁️ Google Drive Setup (Optional)

Google Drive integration is **optional**. The extension works fully for local images without it.

1. Create a [Google Cloud Project](https://console.cloud.google.com/)
2. Enable **Google Drive API** and **Google Picker API**
3. Create an **OAuth 2.0 Client ID** (Chrome Extension type)
4. Update credentials in:
   ```
   src/shared/constants.ts  → GOOGLE_CLIENT_ID, GOOGLE_API_KEY
   public/manifest.json     → oauth2.client_id
   ```
5. Rebuild and reload the extension

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript |
| Build | Vite + CRXJS Plugin |
| AI Model | TensorFlow.js + MobileNet V2 |
| Storage | IndexedDB (Dexie.js) |
| Auth | chrome.identity OAuth 2.0 |
| Cloud | Google Drive API v3 |
| Extension | Chrome Manifest V3 |

## 🔒 Privacy

This extension is **100% local**:

- **Local AI**: All image analysis runs in your browser via TensorFlow.js (WebGL/CPU)
- **Local Storage**: Embeddings, thumbnails, and metadata stay in IndexedDB
- **No Uploads**: Zero images or data are sent to any external server
- **No Tracking**: No analytics, no telemetry, no third-party scripts
- **Google Drive**: Only reads files you explicitly select (requires `drive.readonly` scope)

## ⚠️ Limitations

- **Model Size**: MobileNet weights are ~14MB, loaded on first use
- **Index Size**: Recommended max ~5,000 images (configurable in settings)
- **Text Search**: Limited to ImageNet's 1000 categories (not free-form language)
- **File URLs**: "Allow access to file URLs" must be enabled in `chrome://extensions` for folder detection
- **Browser Only**: Runs on CPU/WebGL — not GPU-optimized for very large collections

## 📄 License

MIT
