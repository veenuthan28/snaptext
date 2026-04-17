# SnapText

Extract text from any image on any webpage — locally, using OCR powered by [Tesseract.js](https://github.com/naptha/tesseract.js). No external APIs, everything runs in your browser.

## Features

- **Right-click any image** → _"Extract Text with SnapText"_
- **Local OCR** via Tesseract.js (no data leaves your machine)
- **Multi-language**: English, German, French (loaded simultaneously)
- Clean slide-in overlay with live progress indicator
- One-click **Copy to clipboard**
- Fully **Manifest V3** compliant

## Folder Structure

```
snaptext/
├── manifest.json            # Extension manifest (V3)
├── background.js            # Service worker – context menu & message routing
├── content.js               # Content script – overlay UI
├── overlay.css              # Shadow-DOM-scoped overlay styles
├── offscreen.html           # Offscreen document shell
├── offscreen.js             # Tesseract.js OCR logic
├── package.json             # npm dependencies
├── scripts/
│   └── build.js             # Copies Tesseract.js files into lib/
├── lib/                     # (generated) Tesseract.js runtime
│   ├── tesseract.min.js
│   ├── worker.min.js
│   └── tesseract-core-*
├── icons/
│   ├── icon.svg             # Source vector icon
│   ├── icon16.png           # (generated)
│   ├── icon48.png           # (generated)
│   └── icon128.png          # (generated)
└── tools/
    └── generate-icons.html  # Open in Chrome to export PNGs
```

## Setup

### Prerequisites

- **Node.js** ≥ 16
- **Google Chrome**

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy Tesseract.js runtime files into lib/
npm run build
```

### Generate PNG Icons

1. Open `tools/generate-icons.html` in Chrome
2. Click **Download All**
3. Move the three PNG files into the `icons/` folder

### Load the Extension

1. Open **chrome://extensions/**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this project folder
4. Done — right-click any image and choose _"Extract Text with SnapText"_

## How It Works

1. User right-clicks an image → selects the context-menu item
2. The **background service worker** creates an offscreen document (if needed) and passes the image URL
3. The **offscreen document** fetches the image and runs Tesseract.js OCR in a Web Worker
4. Results are relayed back through the background to the **content script**
5. The content script renders the extracted text in a Shadow-DOM overlay

## License

MIT
