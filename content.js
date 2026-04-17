/* SnapText – Content Script (overlay UI) */

let overlayHost = null;
let shadowRef = null;
let currentRequestId = null;
let currentText = '';

/* ---- Message listener ---- */

chrome.runtime.onMessage.addListener((msg) => {
  console.log(
    '[SnapText UI] Message received:',
    msg.action,
    msg.action === 'showError' ? msg.error : '',
    msg.action === 'showResult' ? `(${msg.text?.length} chars)` : '',
  );
  switch (msg.action) {
    case 'showLoading':
      currentRequestId = msg.requestId;
      showLoading();
      break;
    case 'updateProgress':
      if (msg.requestId === currentRequestId) updateProgress(msg.progress);
      break;
    case 'showResult':
      if (msg.requestId === currentRequestId) showResult(msg.text);
      break;
    case 'showError':
      if (msg.requestId === currentRequestId) showError(msg.error);
      break;
  }
});

/* ---- Overlay lifecycle ---- */

function ensureOverlay() {
  if (overlayHost) return;

  overlayHost = document.createElement('div');
  shadowRef = overlayHost.attachShadow({ mode: 'open' });

  // Load isolated CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('overlay.css');
  shadowRef.appendChild(link);

  // Shell
  const overlay = document.createElement('div');
  overlay.className = 'snaptext-overlay';
  overlay.innerHTML = `
    <div class="snaptext-header">
      <span class="snaptext-title">
        <svg width="18" height="18" viewBox="0 0 128 128" style="vertical-align:-3px;margin-right:6px">
          <rect width="128" height="128" rx="24" fill="#fff" opacity=".25"/>
          <line x1="38" y1="48" x2="90" y2="48" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
          <line x1="38" y1="64" x2="82" y2="64" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
          <line x1="38" y1="80" x2="70" y2="80" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
        </svg>
        SnapText
      </span>
      <button class="snaptext-close" aria-label="Close">&times;</button>
    </div>
    <div class="snaptext-body"></div>
    <div class="snaptext-footer"></div>
  `;
  shadowRef.appendChild(overlay);

  // Close button
  shadowRef
    .querySelector('.snaptext-close')
    .addEventListener('click', removeOverlay);

  // ESC key closes overlay
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlayHost);
}

function removeOverlay() {
  if (!overlayHost) return;
  const overlay = shadowRef.querySelector('.snaptext-overlay');
  if (overlay) {
    overlay.classList.add('snaptext-slide-out');
    overlay.addEventListener(
      'animationend',
      () => {
        overlayHost?.remove();
        overlayHost = null;
        shadowRef = null;
      },
      { once: true },
    );
  } else {
    overlayHost.remove();
    overlayHost = null;
    shadowRef = null;
  }
  document.removeEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.key === 'Escape') removeOverlay();
}

/* ---- State renderers ---- */

function showLoading() {
  removeOverlayInstant();
  ensureOverlay();
  body().innerHTML = `
    <div class="snaptext-loading">
      <div class="snaptext-spinner"></div>
      <p class="snaptext-status">Extracting text…</p>
      <p class="snaptext-progress"></p>
    </div>`;
  footer().innerHTML = '';
}

function updateProgress(pct) {
  if (!shadowRef) return;
  const el = shadowRef.querySelector('.snaptext-progress');
  if (el) el.textContent = pct + '%';
  const st = shadowRef.querySelector('.snaptext-status');
  if (st && pct > 0) st.textContent = 'Recognizing text…';
}

function showResult(text) {
  if (!shadowRef) {
    ensureOverlay();
  }
  currentText = text;

  if (!text) {
    body().innerHTML = `<div class="snaptext-empty">No text detected in this image.</div>`;
    footer().innerHTML = '';
    return;
  }

  body().innerHTML = `<pre class="snaptext-text">${escapeHtml(text)}</pre>`;
  footer().innerHTML = `<button class="snaptext-copy">📋 Copy Text</button>`;
  footer()
    .querySelector('.snaptext-copy')
    .addEventListener('click', handleCopy);
}

function showError(error) {
  if (!shadowRef) {
    ensureOverlay();
  }
  body().innerHTML = `<div class="snaptext-error"><p>⚠️ ${escapeHtml(error)}</p></div>`;
  footer().innerHTML = '';
}

/* ---- Helpers ---- */

function body() {
  return shadowRef.querySelector('.snaptext-body');
}
function footer() {
  return shadowRef.querySelector('.snaptext-footer');
}

function removeOverlayInstant() {
  if (!overlayHost) return;
  overlayHost.remove();
  overlayHost = null;
  shadowRef = null;
  document.removeEventListener('keydown', onKeyDown);
}

async function handleCopy() {
  const btn = shadowRef?.querySelector('.snaptext-copy');
  if (!btn) return;
  const ok = await copyToClipboard(currentText);
  btn.textContent = ok ? '✅ Copied!' : '❌ Copy failed';
  setTimeout(() => {
    if (btn) btn.textContent = '📋 Copy Text';
  }, 2000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for restricted pages
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
