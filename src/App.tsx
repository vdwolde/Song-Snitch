import { useEffect, useState } from 'react';
import type { Item } from '../shared/types';
import { api } from './api';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listItems().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      const item = await api.addItem(label.trim());
      setItems((prev) => [item, ...prev]);
      setLabel('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="app">
      <h1>{'Song Snitch'}</h1>
      <form onSubmit={handleAdd}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item" />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
      <footer className="app-footer">
        <a href="https://vdwolde.com/" target="_blank" rel="noopener noreferrer">
          {'By vdWolde'}
        </a>
      </footer>
    </main>
  );
}
