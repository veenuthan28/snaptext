/* SnapText – Background Service Worker (Manifest V3) */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'snaptext-extract',
    title: 'Extract Text with SnapText',
    contexts: ['image'],
  });
});

// Handle context-menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'snaptext-extract' || !info.srcUrl) return;

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Tell the content script to show the loading overlay
  chrome.tabs
    .sendMessage(tab.id, {
      action: 'showLoading',
      requestId,
    })
    .catch(() => {});

  try {
    // 1. Fetch image in background service worker (bypasses CORS completely)
    console.log('[SnapText BG] Fetching image:', info.srcUrl.slice(0, 120));
    const imageDataUrl = await fetchImageAsDataUrl(info.srcUrl);
    console.log(
      '[SnapText BG] Image fetched, data URL length:',
      imageDataUrl.length,
    );

    // 2. Ensure offscreen document exists
    console.log('[SnapText BG] Ensuring offscreen document…');
    await ensureOffscreenDocument();
    console.log('[SnapText BG] Offscreen document ready.');

    // 3. Send to offscreen with retry (scripts may still be loading)
    console.log('[SnapText BG] Sending performOCR to offscreen…');
    await sendToOffscreen({
      action: 'performOCR',
      imageDataUrl,
      tabId: tab.id,
      requestId,
    });
    console.log('[SnapText BG] Offscreen acknowledged OCR request.');
  } catch (err) {
    console.error('[SnapText BG] Error in OCR pipeline:', err);
    chrome.tabs
      .sendMessage(tab.id, {
        action: 'showError',
        error: err.message || 'Failed to start OCR processing.',
        requestId,
      })
      .catch(() => {});
  }
});

// Relay messages from offscreen document → content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'background') return;
  console.log(
    '[SnapText BG] Relay message:',
    msg.action,
    msg.action === 'ocrError' ? msg.error : '',
  );

  const forward = (payload) =>
    chrome.tabs
      .sendMessage(msg.tabId, { ...payload, requestId: msg.requestId })
      .catch(() => {});

  if (msg.action === 'ocrResult') {
    forward({ action: 'showResult', text: msg.text });
  } else if (msg.action === 'ocrError') {
    forward({ action: 'showError', error: msg.error });
  } else if (msg.action === 'ocrProgress') {
    forward({ action: 'updateProgress', progress: msg.progress });
  }
});

/* ---- Image fetch (background has full host_permissions → no CORS) ---- */

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

/* ---- Send message to offscreen with retry (handles script-load race) ---- */

async function sendToOffscreen(msg, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[SnapText BG] sendToOffscreen attempt ${i + 1}/${retries}`);
      const response = await chrome.runtime.sendMessage(msg);
      console.log('[SnapText BG] sendToOffscreen response:', response);
      if (response && response.received) return;
    } catch (e) {
      console.warn(
        `[SnapText BG] sendToOffscreen attempt ${i + 1} failed:`,
        e.message,
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('OCR processor did not respond. Please try again.');
}

/* ---- Offscreen document helpers ---- */

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run Tesseract.js OCR in a Web Worker for text extraction.',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}
