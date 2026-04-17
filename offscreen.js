/* SnapText – Offscreen OCR processor */

console.log('[SnapText OCR] Offscreen script loaded.');

// ---- Persistent worker (created once, reused across requests) ----

let persistentWorker = null;
let workerReady = null; // Promise that resolves when the worker is ready

function getWorker() {
  if (workerReady) return workerReady;
  workerReady = initWorker();
  return workerReady;
}

async function initWorker() {
  const workerPath = chrome.runtime.getURL('lib/worker.min.js');
  const corePath = chrome.runtime.getURL('lib/');
  console.log('[SnapText OCR] Initialising persistent worker…');
  console.log('[SnapText OCR]   workerPath:', workerPath);
  console.log('[SnapText OCR]   corePath:', corePath);

  const t0 = performance.now();
  persistentWorker = await Tesseract.createWorker('eng+deu+fra', 1, {
    workerPath,
    corePath,
    workerBlobURL: false,
    cacheMethod: 'readOnly', // use browser cache for trained data
  });
  console.log(
    `[SnapText OCR] Worker ready in ${Math.round(performance.now() - t0)} ms`,
  );
  return persistentWorker;
}

// Pre-warm the worker immediately on load (so the first OCR is fast)
getWorker().catch((err) => {
  console.error('[SnapText OCR] Pre-warm failed:', err);
  workerReady = null; // allow retry on next request
});

// ---- Message listener ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'performOCR') {
    console.log(
      '[SnapText OCR] Received performOCR, dataUrl length:',
      msg.imageDataUrl?.length,
    );
    sendResponse({ received: true });
    runOCR(msg.imageDataUrl, msg.tabId, msg.requestId);
  }
});

// ---- OCR runner ----

async function runOCR(imageDataUrl, tabId, requestId) {
  function sendError(errObj) {
    let msg;
    if (errObj instanceof Error) {
      msg = `${errObj.message}\n${errObj.stack || ''}`;
    } else if (typeof errObj === 'string') {
      msg = errObj;
    } else {
      try {
        msg = JSON.stringify(errObj);
      } catch {
        msg = String(errObj);
      }
    }
    console.error('[SnapText OCR] ERROR:', errObj);
    chrome.runtime
      .sendMessage({
        target: 'background',
        action: 'ocrError',
        tabId,
        requestId,
        error: msg || 'Unknown OCR error',
      })
      .catch(() => {});
  }

  function sendProgress(progress) {
    chrome.runtime
      .sendMessage({
        target: 'background',
        action: 'ocrProgress',
        tabId,
        requestId,
        progress,
      })
      .catch(() => {});
  }

  try {
    const t0 = performance.now();

    // Get or wait for the persistent worker
    let worker;
    try {
      worker = await getWorker();
    } catch (workerErr) {
      // First init failed — retry once
      console.warn('[SnapText OCR] Worker init failed, retrying…', workerErr);
      workerReady = null;
      worker = await getWorker();
    }
    console.log(
      `[SnapText OCR] Worker acquired in ${Math.round(performance.now() - t0)} ms`,
    );

    sendProgress(5);

    const t1 = performance.now();
    const result = await worker.recognize(imageDataUrl);
    const text = result.data.text;
    console.log(
      `[SnapText OCR] recognize() done in ${Math.round(performance.now() - t1)} ms, ${text.length} chars`,
    );

    chrome.runtime
      .sendMessage({
        target: 'background',
        action: 'ocrResult',
        tabId,
        requestId,
        text: text.trim(),
      })
      .catch(() => {});
  } catch (err) {
    sendError(err);
    // If the worker itself is broken, reset so the next request creates a fresh one
    persistentWorker = null;
    workerReady = null;
  }
}
