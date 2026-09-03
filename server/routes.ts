import type { FastifyInstance } from 'fastify';
import { insertItem, listItems } from './db';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/items', async () => listItems());

  app.post('/api/items', async (req, reply) => {
    const { label } = (req.body ?? {}) as { label?: string };
    if (!label || !label.trim()) {
      reply.code(400);
      return { error: 'label is required' };
    }
    return insertItem(label.trim());
  });
}
