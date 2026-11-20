// Guards the brand wiring that a typecheck cannot see: every player colour in the wire
// contract has a CSS rule, and the app loads no CDN fonts (Brand Guide v1.0: self-hosted).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PLAYER_COLOURS } from '../shared/types';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('every player colour has a [data-colour] rule in styles.css', () => {
  const css = read('src/styles.css');
  for (const c of PLAYER_COLOURS) {
    assert.ok(css.includes(`[data-colour='${c}']`), `missing [data-colour='${c}'] rule`);
  }
});

test('index.html and the styles load no CDN fonts', () => {
  for (const f of ['index.html', 'src/styles.css', 'src/shadcn.css']) {
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(read(f)), `${f} references a font CDN`);
  }
});
