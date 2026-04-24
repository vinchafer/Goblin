import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { chat } from './routes/chat';
import { byokKeys } from './routes/byok-keys';
import { projects } from './routes/projects';
import { github } from './routes/github';
import { billing } from './routes/billing';

const app = new Hono();

app.use('*', cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS']
}));

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'goblin-api',
    timestamp: new Date().toISOString()
  });
});

app.route('/api/chat', chat);
app.route('/api/byok-keys', byokKeys);
app.route('/api/projects', projects);
app.route('/api/github', github);
app.route('/api/billing', billing);

console.log('Goblin API starting on port 3001');
serve({
  fetch: app.fetch,
  port: 3001
});