import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Item } from '../shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'app.db');

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

// node:sqlite bound params accept only null | number | bigint | string | Uint8Array —
// no booleans, no undefined. Convert at the boundary rather than scattering casts.

export function listItems(): Item[] {
  const rows = db.prepare('SELECT id, label, created_at AS createdAt FROM items ORDER BY id DESC').all();
  return rows as unknown as Item[];
}

export function insertItem(label: string): Item {
  const createdAt = new Date().toISOString();
  const result = db.prepare('INSERT INTO items (label, created_at) VALUES (?, ?)').run(label, createdAt);
  return { id: Number(result.lastInsertRowid), label, createdAt };
}
