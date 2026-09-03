import type { Item } from '../shared/types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error((body && body.error) || r.statusText);
  }
  return r.json() as Promise<T>;
}

export const api = {
  listItems: () => j<Item[]>('/api/items'),
  addItem: (label: string) =>
    j<Item>('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }),
};
