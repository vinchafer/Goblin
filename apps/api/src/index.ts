import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { chat } from './routes/chat';
import { billing } from './routes/billing';
import { projects } from './routes/projects';
import { github } from './routes/github';
import { byokKeys as byok } from './routes/byok-keys';

const app = new Hono();

app.use('*', cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true
}));

app.onError((err, c) => {
  console.error('[API Error]', err.message);
  const status = err instanceof HTTPException ? err.status : 500;
  return c.json({ 
    error: status === 500 ? 'Internal server error' : err.message 
  }, status);
});

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'goblin-api',
    timestamp: new Date().toISOString()
  });
});

app.route('/api/chat', chat);
app.route('/api/byok-keys', byok);
app.route('/api/projects', projects);
app.route('/api/github', github);
app.route('/api/billing', billing);

const port = parseInt(process.env.API_PORT || '3001', 10);
console.log(`Goblin API starting on port ${port}`);
serve({
  fetch: app.fetch,
  port
});