#!/usr/bin/env node
/**
 * AssanMart - whole customer app  ->  WHATSAPP-GREEN theme #1DAA61 on light cucumber tints (works from dark green, aqua AND the previous cucumber version).
 *
 *   node retheme.mjs ./src            (preview only)
 *   node retheme.mjs ./src --write    (apply)
 *
 * Palette (option 9, "Fresh Cucumber"):
 *   50 #f3fbf6 | 100 #e0f4e7 | 200 #b3e4c4 | 300 #96d9ae | 400 #7fcf9a | 500 #5bbd7e | 600 #46a468 | 700 #378553 | 800 #2a6b43 | 900 #1f5233
 *   buttons/accent #1daa61, hover #148a4c, soft accent #3fc27b, headings #2a6b43, small green text #148a4c, nav hover line amber #f59e0b.
 *
 * Converts: emerald-* / teal-* classes, bg-[#...] style classes, plain hex in css / inline styles / svg, rgba() glows.
 * Never touches your logo colour #034f21, AnimatedLogo.tsx, MascotAnimation.tsx, node_modules, dist.
 * Safe to run again. Commit first so you can undo with git.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || './src';
const WRITE = process.argv.includes('--write');

const SCALE = { 50: 'f3fbf6', 100: 'e0f4e7', 200: 'b3e4c4', 300: '96d9ae', 400: '7fcf9a', 500: '3fc27b', 600: '1daa61', 700: '148a4c', 800: '2a6b43', 900: '1f5233', 950: '153a24' };
const OUT = new Set([...Object.values(SCALE), '4d7a5c']);      // already final: never touch

/* old dark-green AND aqua hex  ->  cucumber, when used as a background / border / gradient */
const FILL = {
  '377d4f': '148a4c', '336645': '0f6e3d', '46a468': '1daa61', '378553': '148a4c', '5bbd7e': '3fc27b',          // previous cucumber -> WhatsApp green
  '064e3b': '1daa61', '0d9488': '1daa61', '043d2e': '148a4c', '047857': '148a4c', '0f766e': '148a4c', '065f46': '148a4c',
  '022c22': '2a6b43', '115e59': '2a6b43', '134e4a': '1f5233',
  '059669': '3fc27b', '14b8a6': '3fc27b', '10b981': '7fcf9a', '2dd4bf': '7fcf9a', '34d399': '96d9ae', '5eead4': '96d9ae',
  '6ee7b7': 'b3e4c4', '99f6e4': 'b3e4c4', 'a7f3d0': 'b3e4c4',
  'd1fae5': 'e0f4e7', 'ccfbf1': 'e0f4e7', 'e6f4ed': 'e0f4e7', 'cde8dd': 'e0f4e7', 'e2ede6': 'e0f4e7',
  'ecfdf5': 'f3fbf6', 'f0fdf4': 'f3fbf6', 'f0fdfa': 'f3fbf6', 'f2faf5': 'f3fbf6', 'f4fbf6': 'f3fbf6', 'f7fefd': 'f3fbf6',
};
/* ...when used as TEXT colour (must stay readable on white) */
const TEXT = {
  ...FILL,
  '377d4f': '148a4c', '336645': '0f6e3d', '46a468': '148a4c', '378553': '0f6e3d', '5bbd7e': '1daa61',
  '064e3b': '2a6b43', '115e59': '2a6b43', '043d2e': '1f5233', '134e4a': '1f5233',
  '047857': '148a4c', '0f766e': '148a4c', '065f46': '148a4c',
  '059669': '148a4c', '0d9488': '148a4c', '10b981': '148a4c', '14b8a6': '148a4c', '2dd4bf': '1daa61',
  '4b6b60': '4d7a5c', '3f6e6a': '4d7a5c', '022c22': '1f5233',
};
const KEEP = new Set(['034f21', '34a853']);      // your logo colour + the Google logo green
const SKIP_FILE = /(AnimatedLogo|MascotAnimation)\.(tsx|ts|jsx|js)$/;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const EXT = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.html']);

function hexToHsl(h) {
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [hh, s, l];
}
function hslToHex(h, s, l) {
  const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
const stats = { tw: 0, arb: 0, hex: 0, auto: 0, files: 0 };
const leftovers = new Map();

function convertHex(hexRaw, role) {
  const hex = hexRaw.toLowerCase();
  if (KEEP.has(hex) || OUT.has(hex)) return null;
  const map = role === 'text' ? TEXT : FILL;
  if (map[hex]) return map[hex];
  const [h, s, l] = hexToHsl(hex);
  if (h < 80 || h > 190 || s < 0.2) return null;               // not a green / teal: leave it
  const n = hslToHex(141, Math.min(s, 0.55), Math.max(l, role === 'text' ? 0.3 : 0.45));
  stats.auto++; leftovers.set('#' + hex + ' -> #' + n, (leftovers.get('#' + hex + ' -> #' + n) || 0) + 1);
  return n;
}

function transform(src) {
  let out = src;
  // 1. palette classes: bg-emerald-600, hover:text-teal-700, border-t-teal-100, shadow-teal-600/25 ...
  out = out.replace(/\b(bg|text|border(?:-[trblxy])?|ring|from|via|to|fill|stroke|shadow|divide|outline|accent|decoration|placeholder|caret)-(?:emerald|teal)-(50|100|200|300|400|500|600|700|800|900|950)\b/g,
    (_, kind, n) => { stats.tw++; return `${kind}-[#${SCALE[n]}]`; });
  // 2. arbitrary colour classes bg-[#064e3b], text-[#0d9488]/70 ...
  out = out.replace(/\b(bg|from|via|to|border(?:-[trblxy])?|ring|shadow|outline|accent|decoration|divide|text|fill|stroke|placeholder|caret)-\[#([0-9a-fA-F]{6})\]/g, (m, kind, hex) => {
    const role = /^(text|fill|stroke|placeholder|caret|decoration)$/.test(kind) ? 'text' : 'fill';
    const n = convertHex(hex, role); if (!n) return m; stats.arb++; return `${kind}-[#${n}]`;
  });
  // 3. any other #rrggbb: nearest CSS/JS property decides (color/fill/stroke = text, else fill)
  out = out.split('\n').map((line) => {
    if (!/#[0-9a-fA-F]{6}\b/.test(line)) return line;
    return line.replace(/(?<![\w\[-])#([0-9a-fA-F]{6})\b/g, (m, hex, off) => {
      const pm = line.slice(0, off).match(/(?:^|[^\w-])([\w-]+)['"]?\s*:[^:;]*$/);
      const prop = pm ? pm[1].toLowerCase() : '';
      const role = /^(color|fill|stroke|caret-color|-webkit-text-fill-color)$/.test(prop) || /^--.*(ink|text|fg|color)/.test(prop) ? 'text' : 'fill';
      const n = convertHex(hex, role); if (!n) return m; stats.hex++; return '#' + n;
    });
  }).join('\n');
  // 4. rgba() glows / shadows of the old greens
  out = out.replace(/rgba\(\s*(6|13|5|20|16|45)\s*,\s*(78|148|150|184|185|212)\s*,\s*(59|136|105|166|129|191)\s*,/g, (m, r) => {
    stats.hex++; return r === '6' || r === '13' ? 'rgba(29,170,97,' : r === '5' || r === '20' ? 'rgba(63,194,123,' : 'rgba(127,207,154,';
  });
  out = out.replace(/rgba\(\s*70\s*,\s*164\s*,\s*104\s*,/g, () => { stats.hex++; return 'rgba(29,170,97,'; });
  out = out.replace(/rgba\(\s*91\s*,\s*189\s*,\s*126\s*,/g, () => { stats.hex++; return 'rgba(63,194,123,'; });
  return out;
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p); continue; }
    if (!EXT.has(path.extname(e.name)) || SKIP_FILE.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8'); const out = transform(src);
    if (out !== src) { stats.files++; console.log((WRITE ? 'updated  ' : 'would update ') + p); if (WRITE) fs.writeFileSync(p, out); }
  }
}

if (!fs.existsSync(root)) { console.error('Folder not found: ' + root); process.exit(1); }
walk(root);
console.log(`\nfiles: ${stats.files} | palette classes: ${stats.tw} | arbitrary classes: ${stats.arb} | plain hex: ${stats.hex} | auto-shifted: ${stats.auto}`);
if (leftovers.size) { console.log('\nColours not in the table (auto-shifted, please glance at them):'); for (const [k, v] of leftovers) console.log('  ' + k + '  x' + v); }
if (!WRITE) console.log('\nPreview only. Add --write to apply.');
