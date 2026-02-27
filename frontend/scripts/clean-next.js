const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log('[predev] cleaned .next');
} catch (e) {
  // eslint-disable-next-line no-console
  console.log('[predev] skip cleanup:', e && e.message ? e.message : String(e));
}
