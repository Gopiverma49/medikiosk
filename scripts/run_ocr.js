const fs = require('fs');
const path = require('path');

// Resolve tesseract.js from frontend/node_modules
let createWorker;
try {
  ({ createWorker } = require('../frontend/node_modules/tesseract.js'));
} catch (e) {
  try {
    ({ createWorker } = require('tesseract.js'));
  } catch (e2) {
    console.error("Tesseract module not found");
    process.exit(1);
  }
}

const os = require('os');

async function main() {
  const imgPath = process.argv[2];
  if (!imgPath || !fs.existsSync(imgPath)) {
    console.error("Image path required and must exist: " + imgPath);
    process.exit(1);
  }

  try {
    const cacheDir = path.join(os.tmpdir(), 'medikiosk-ocr');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const worker = await createWorker('eng', 1, {
      cachePath: cacheDir,
    });
    const ret = await worker.recognize(imgPath);
    await worker.terminate();
    process.stdout.write(ret.data.text || "");
  } catch (err) {
    console.error("OCR Error:", err.message);
    process.exit(1);
  }
}

main();
