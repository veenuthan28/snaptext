/**
 * build.js – Copies the required Tesseract.js runtime files into lib/
 * so they can be loaded by the extension's offscreen document.
 *
 * Usage:  npm run build
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, 'lib');

if (!fs.existsSync(LIB)) fs.mkdirSync(LIB, { recursive: true });

function copy(src, destName) {
  if (!fs.existsSync(src)) {
    console.error(`  ✗ Not found: ${src}`);
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(src, path.join(LIB, destName));
  console.log(`  ✓ ${destName}`);
}

console.log('Copying Tesseract.js files to lib/ …\n');

// 1. Main library + worker
const dist = path.join(ROOT, 'node_modules', 'tesseract.js', 'dist');
copy(path.join(dist, 'tesseract.min.js'), 'tesseract.min.js');
copy(path.join(dist, 'worker.min.js'), 'worker.min.js');

// 2. WASM core files (SIMD + non-SIMD fallback)
const corePkg = path.join(ROOT, 'node_modules', 'tesseract.js-core');
if (fs.existsSync(corePkg)) {
  const files = fs
    .readdirSync(corePkg)
    .filter((f) => f.startsWith('tesseract-core') && /\.(js|wasm)$/.test(f));
  files.forEach((f) => copy(path.join(corePkg, f), f));
} else {
  console.error('  ✗ tesseract.js-core not found – run npm install first.');
  process.exitCode = 1;
}

console.log('\nDone. Now load the extension folder in chrome://extensions/');
