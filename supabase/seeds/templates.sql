-- Goblin Templates Seed
-- 10 official starter templates
-- Run AFTER migrations (templates table must exist)

-- ============================================================================
-- Create templates table if not yet created via migration
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL,
  tags           TEXT[] DEFAULT '{}',
  thumbnail_url  TEXT,
  author_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_official    BOOLEAN DEFAULT false,
  is_public      BOOLEAN DEFAULT true,
  downloads      INTEGER DEFAULT 0,
  files          JSONB NOT NULL DEFAULT '{}',
  tech_stack     TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public templates are readable by all"
  ON templates FOR SELECT USING (is_public = true);

CREATE POLICY IF NOT EXISTS "Admins can manage templates"
  ON templates FOR ALL USING (auth.uid() IS NOT NULL AND is_official = true);

-- ============================================================================
-- 1. SaaS Starter
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'SaaS Starter',
  'saas-starter',
  'Full-stack SaaS boilerplate with auth, billing, and dashboard. Stripe Checkout, Supabase auth, and a responsive dashboard shell included.',
  'saas',
  ARRAY['nextjs', 'supabase', 'stripe', 'tailwind', 'auth', 'billing'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "import Link from 'next/link';\n\nexport default function HomePage() {\n  return (\n    <main className=\"min-h-screen bg-gray-950 text-white\">\n      <nav className=\"flex items-center justify-between px-6 py-4 border-b border-gray-800\">\n        <span className=\"text-xl font-bold text-indigo-400\">Acme</span>\n        <div className=\"flex gap-4\">\n          <Link href=\"/pricing\" className=\"text-gray-300 hover:text-white\">Pricing</Link>\n          <Link href=\"/dashboard\" className=\"bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm font-medium\">Dashboard</Link>\n        </div>\n      </nav>\n      <section className=\"max-w-4xl mx-auto px-6 py-24 text-center\">\n        <h1 className=\"text-5xl font-extrabold mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent\">\n          Ship faster. Grow smarter.\n        </h1>\n        <p className=\"text-xl text-gray-400 mb-10\">\n          The SaaS starter kit that handles auth, billing, and infra so you can focus on your product.\n        </p>\n        <div className=\"flex justify-center gap-4\">\n          <Link href=\"/dashboard\" className=\"bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-semibold\">Get started free</Link>\n          <Link href=\"/pricing\" className=\"border border-gray-700 hover:border-gray-500 px-6 py-3 rounded-xl font-semibold\">View pricing</Link>\n        </div>\n      </section>\n    </main>\n  );\n}",
    "app/dashboard/page.tsx": "import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';\nimport { cookies } from 'next/headers';\nimport { redirect } from 'next/navigation';\n\nexport default async function DashboardPage() {\n  const supabase = createServerComponentClient({ cookies });\n  const { data: { session } } = await supabase.auth.getSession();\n  if (!session) redirect('/login');\n\n  const stats = [\n    { label: 'Monthly Revenue', value: '$4,280', delta: '+12%' },\n    { label: 'Active Users', value: '1,340', delta: '+5%' },\n    { label: 'Churn Rate', value: '2.1%', delta: '-0.3%' },\n    { label: 'Open Tickets', value: '7', delta: '-2' },\n  ];\n\n  return (\n    <div className=\"p-8\">\n      <h1 className=\"text-2xl font-bold mb-8\">Dashboard</h1>\n      <div className=\"grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8\">\n        {stats.map((s) => (\n          <div key={s.label} className=\"bg-gray-800 rounded-xl p-5\">\n            <p className=\"text-sm text-gray-400\">{s.label}</p>\n            <p className=\"text-2xl font-bold mt-1\">{s.value}</p>\n            <p className=\"text-xs text-green-400 mt-1\">{s.delta}</p>\n          </div>\n        ))}\n      </div>\n      <div className=\"bg-gray-800 rounded-xl p-6\">\n        <h2 className=\"text-lg font-semibold mb-4\">Recent Activity</h2>\n        <p className=\"text-gray-400 text-sm\">No activity yet.</p>\n      </div>\n    </div>\n  );\n}",
    "app/pricing/page.tsx": "import Link from 'next/link';\n\nconst plans = [\n  { name: 'Starter', price: '$9', features: ['5 projects', '10k API calls', 'Email support'], cta: 'Get Starter', highlight: false },\n  { name: 'Pro', price: '$29', features: ['Unlimited projects', '100k API calls', 'Priority support', 'Team members'], cta: 'Get Pro', highlight: true },\n  { name: 'Enterprise', price: '$99', features: ['Everything in Pro', 'Custom integrations', 'SLA', 'Dedicated support'], cta: 'Contact sales', highlight: false },\n];\n\nexport default function PricingPage() {\n  return (\n    <main className=\"min-h-screen bg-gray-950 text-white py-20 px-6\">\n      <div className=\"max-w-5xl mx-auto\">\n        <h1 className=\"text-4xl font-bold text-center mb-4\">Simple, honest pricing</h1>\n        <p className=\"text-center text-gray-400 mb-12\">Cancel anytime. No hidden fees.</p>\n        <div className=\"grid md:grid-cols-3 gap-6\">\n          {plans.map((plan) => (\n            <div key={plan.name} className={`rounded-2xl p-6 border ${plan.highlight ? 'border-indigo-500 bg-indigo-950' : 'border-gray-700 bg-gray-900'}`}>\n              <h2 className=\"text-xl font-semibold\">{plan.name}</h2>\n              <p className=\"text-3xl font-bold mt-2 mb-4\">{plan.price}<span className=\"text-sm font-normal text-gray-400\">/mo</span></p>\n              <ul className=\"space-y-2 mb-6\">\n                {plan.features.map((f) => <li key={f} className=\"text-sm text-gray-300\">✓ {f}</li>)}\n              </ul>\n              <Link href=\"/api/checkout\" className={`block text-center py-2 rounded-lg font-medium ${plan.highlight ? 'bg-indigo-600 hover:bg-indigo-500' : 'border border-gray-600 hover:border-gray-400'}`}>{plan.cta}</Link>\n            </div>\n          ))}\n        </div>\n      </div>\n    </main>\n  );\n}",
    "app/api/checkout/route.ts": "import { NextRequest, NextResponse } from 'next/server';\n\nexport async function POST(req: NextRequest) {\n  // TODO: replace with your Stripe secret key\n  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;\n  if (!stripeSecretKey) {\n    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });\n  }\n\n  const { priceId } = await req.json();\n\n  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {\n    method: 'POST',\n    headers: {\n      Authorization: `Bearer ${stripeSecretKey}`,\n      'Content-Type': 'application/x-www-form-urlencoded',\n    },\n    body: new URLSearchParams({\n      mode: 'subscription',\n      'line_items[0][price]': priceId,\n      'line_items[0][quantity]': '1',\n      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?checkout=success`,\n      cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,\n    }),\n  });\n\n  const session = await res.json();\n  return NextResponse.json({ url: session.url });\n}",
    "lib/supabase.ts": "import { createBrowserClient } from '@supabase/ssr';\n\nexport function createClient() {\n  return createBrowserClient(\n    process.env.NEXT_PUBLIC_SUPABASE_URL!,\n    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!\n  );\n}",
    "middleware.ts": "import { createServerClient } from '@supabase/ssr';\nimport { NextResponse, type NextRequest } from 'next/server';\n\nexport async function middleware(request: NextRequest) {\n  const response = NextResponse.next();\n  const supabase = createServerClient(\n    process.env.NEXT_PUBLIC_SUPABASE_URL!,\n    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,\n    { cookies: { getAll: () => request.cookies.getAll(), setAll: (pairs) => pairs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }\n  );\n  const { data: { session } } = await supabase.auth.getSession();\n  const isProtected = request.nextUrl.pathname.startsWith('/dashboard');\n  if (isProtected && !session) {\n    return NextResponse.redirect(new URL('/login', request.url));\n  }\n  return response;\n}\n\nexport const config = { matcher: ['/dashboard/:path*'] };"
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind', 'supabase', 'stripe'],
  NOW()
);

-- ============================================================================
-- 2. Landing Page Pro
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Landing Page Pro',
  'landing-pro',
  'High-converting landing page with hero, features grid, testimonials, FAQ section, and footer. Ready to deploy.',
  'landing',
  ARRAY['landing', 'marketing', 'nextjs', 'tailwind'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "import Nav from '@/components/Nav';\n\nconst features = [\n  { icon: '⚡', title: 'Blazing Fast', desc: 'Built on Next.js 15 with edge rendering for sub-100ms responses.' },\n  { icon: '🔒', title: 'Secure by Default', desc: 'Auth, RLS, and encrypted storage out of the box.' },\n  { icon: '📊', title: 'Analytics Built-in', desc: 'Track conversions without third-party scripts.' },\n  { icon: '🎨', title: 'Fully Customizable', desc: 'Tailwind-based design system, override anything.' },\n  { icon: '🌍', title: 'Global CDN', desc: 'Deployed to 30+ edge locations worldwide.' },\n  { icon: '🤝', title: 'Great Support', desc: 'Dedicated Slack channel and 24h response SLA.' },\n];\n\nconst testimonials = [\n  { name: 'Sarah K.', role: 'Founder, Loops', quote: 'Went from idea to live product in 48 hours. Insane.' },\n  { name: 'James T.', role: 'CTO, Pico', quote: 'The cleanest starter kit I have ever used.' },\n  { name: 'Mia L.', role: 'Indie Hacker', quote: 'Made my first $1k MRR within two weeks of launching.' },\n];\n\nconst faqs = [\n  { q: 'Is there a free tier?', a: 'Yes, you can start for free and upgrade when you need more.' },\n  { q: 'Can I use my own domain?', a: 'Absolutely. Custom domains are supported on all paid plans.' },\n  { q: 'What stack does this use?', a: 'Next.js 15, Tailwind CSS, and Supabase. All open-source.' },\n];\n\nexport default function LandingPage() {\n  return (\n    <div className=\"min-h-screen bg-white\">\n      <Nav />\n\n      {/* Hero */}\n      <section className=\"max-w-5xl mx-auto px-6 pt-24 pb-20 text-center\">\n        <span className=\"inline-block bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mb-4\">Now in public beta</span>\n        <h1 className=\"text-6xl font-black tracking-tight text-gray-900 mb-6\">The last tool<br/>you will ever need</h1>\n        <p className=\"text-xl text-gray-500 mb-10 max-w-2xl mx-auto\">Everything your team needs to build, ship, and grow — in one place. No duct tape required.</p>\n        <div className=\"flex justify-center gap-4\">\n          <a href=\"#\" className=\"bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold\">Start for free</a>\n          <a href=\"#features\" className=\"text-gray-600 hover:text-gray-900 px-8 py-3 rounded-xl border border-gray-300 font-semibold\">See features</a>\n        </div>\n      </section>\n\n      {/* Features */}\n      <section id=\"features\" className=\"bg-gray-50 py-20 px-6\">\n        <div className=\"max-w-5xl mx-auto\">\n          <h2 className=\"text-3xl font-bold text-center mb-12\">Everything you need</h2>\n          <div className=\"grid sm:grid-cols-2 lg:grid-cols-3 gap-6\">\n            {features.map((f) => (\n              <div key={f.title} className=\"bg-white p-6 rounded-2xl border border-gray-200\">\n                <span className=\"text-3xl\">{f.icon}</span>\n                <h3 className=\"font-semibold mt-3 mb-1\">{f.title}</h3>\n                <p className=\"text-sm text-gray-500\">{f.desc}</p>\n              </div>\n            ))}\n          </div>\n        </div>\n      </section>\n\n      {/* Testimonials */}\n      <section className=\"py-20 px-6\">\n        <div className=\"max-w-4xl mx-auto\">\n          <h2 className=\"text-3xl font-bold text-center mb-12\">Loved by builders</h2>\n          <div className=\"grid md:grid-cols-3 gap-6\">\n            {testimonials.map((t) => (\n              <div key={t.name} className=\"bg-gray-50 p-6 rounded-2xl\">\n                <p className=\"text-gray-700 italic mb-4\">\"{t.quote}\"</p>\n                <p className=\"font-semibold text-sm\">{t.name}</p>\n                <p className=\"text-xs text-gray-400\">{t.role}</p>\n              </div>\n            ))}\n          </div>\n        </div>\n      </section>\n\n      {/* FAQ */}\n      <section className=\"bg-gray-50 py-20 px-6\">\n        <div className=\"max-w-2xl mx-auto\">\n          <h2 className=\"text-3xl font-bold text-center mb-12\">Frequently asked</h2>\n          <div className=\"space-y-4\">\n            {faqs.map((f) => (\n              <div key={f.q} className=\"bg-white p-5 rounded-xl border border-gray-200\">\n                <p className=\"font-semibold\">{f.q}</p>\n                <p className=\"text-gray-500 text-sm mt-1\">{f.a}</p>\n              </div>\n            ))}\n          </div>\n        </div>\n      </section>\n\n      {/* CTA */}\n      <section className=\"py-24 px-6 text-center\">\n        <h2 className=\"text-4xl font-black mb-6\">Ready to ship?</h2>\n        <a href=\"#\" className=\"bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-semibold text-lg\">Get started — it's free</a>\n      </section>\n\n      {/* Footer */}\n      <footer className=\"border-t border-gray-200 py-8 px-6 text-center text-sm text-gray-400\">\n        © {new Date().getFullYear()} Acme Inc. All rights reserved.\n      </footer>\n    </div>\n  );\n}",
    "components/Nav.tsx": "'use client';\nimport Link from 'next/link';\nimport { useState } from 'react';\n\nexport default function Nav() {\n  const [open, setOpen] = useState(false);\n  return (\n    <nav className=\"sticky top-0 z-50 bg-white border-b border-gray-200\">\n      <div className=\"max-w-5xl mx-auto px-6 h-16 flex items-center justify-between\">\n        <Link href=\"/\" className=\"text-xl font-black text-gray-900\">Acme</Link>\n        <div className=\"hidden md:flex items-center gap-6 text-sm\">\n          <a href=\"#features\" className=\"text-gray-500 hover:text-gray-900\">Features</a>\n          <a href=\"#\" className=\"text-gray-500 hover:text-gray-900\">Pricing</a>\n          <a href=\"#\" className=\"text-gray-500 hover:text-gray-900\">Docs</a>\n          <Link href=\"#\" className=\"bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium\">Sign up</Link>\n        </div>\n        <button className=\"md:hidden\" onClick={() => setOpen(!open)}>☰</button>\n      </div>\n      {open && (\n        <div className=\"md:hidden border-t border-gray-100 px-6 py-4 flex flex-col gap-3 text-sm\">\n          <a href=\"#features\">Features</a>\n          <a href=\"#\">Pricing</a>\n          <a href=\"#\">Docs</a>\n          <Link href=\"#\" className=\"bg-indigo-600 text-white px-4 py-2 rounded-lg text-center\">Sign up</Link>\n        </div>\n      )}\n    </nav>\n  );\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind'],
  NOW()
);

-- ============================================================================
-- 3. REST API Backend
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'REST API Backend',
  'api-backend',
  'Production-ready Hono API with CORS, JWT auth middleware, and full CRUD routes. Deployable to Cloudflare Workers or Node.',
  'api',
  ARRAY['hono', 'api', 'rest', 'typescript', 'supabase', 'backend'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "src/index.ts": "import { Hono } from 'hono';\nimport { cors } from 'hono/cors';\nimport { logger } from 'hono/logger';\nimport items from './routes/items';\n\nconst app = new Hono();\n\napp.use('*', logger());\napp.use('/api/*', cors({\n  origin: process.env.ALLOWED_ORIGIN ?? '*',\n  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],\n  allowHeaders: ['Content-Type', 'Authorization'],\n}));\n\napp.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));\napp.route('/api/items', items);\n\napp.onError((err, c) => {\n  console.error(err);\n  return c.json({ error: err.message }, 500);\n});\n\nexport default app;",
    "src/routes/items.ts": "import { Hono } from 'hono';\nimport { authMiddleware } from '../middleware/auth';\nimport { createClient } from '@supabase/supabase-js';\n\nconst items = new Hono();\n\nfunction db() {\n  return createClient(\n    process.env.SUPABASE_URL!,\n    process.env.SUPABASE_SERVICE_ROLE_KEY!\n  );\n}\n\nitems.use('*', authMiddleware);\n\n// GET /api/items\nitems.get('/', async (c) => {\n  const userId = c.get('userId');\n  const { data, error } = await db().from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false });\n  if (error) return c.json({ error: error.message }, 400);\n  return c.json(data);\n});\n\n// GET /api/items/:id\nitems.get('/:id', async (c) => {\n  const userId = c.get('userId');\n  const { data, error } = await db().from('items').select('*').eq('id', c.req.param('id')).eq('user_id', userId).single();\n  if (error) return c.json({ error: 'Not found' }, 404);\n  return c.json(data);\n});\n\n// POST /api/items\nitems.post('/', async (c) => {\n  const userId = c.get('userId');\n  const body = await c.req.json<{ name: string; value?: string }>();\n  if (!body.name) return c.json({ error: 'name is required' }, 422);\n  const { data, error } = await db().from('items').insert({ name: body.name, value: body.value, user_id: userId }).select().single();\n  if (error) return c.json({ error: error.message }, 400);\n  return c.json(data, 201);\n});\n\n// PUT /api/items/:id\nitems.put('/:id', async (c) => {\n  const userId = c.get('userId');\n  const body = await c.req.json();\n  const { data, error } = await db().from('items').update(body).eq('id', c.req.param('id')).eq('user_id', userId).select().single();\n  if (error) return c.json({ error: error.message }, 400);\n  return c.json(data);\n});\n\n// DELETE /api/items/:id\nitems.delete('/:id', async (c) => {\n  const userId = c.get('userId');\n  const { error } = await db().from('items').delete().eq('id', c.req.param('id')).eq('user_id', userId);\n  if (error) return c.json({ error: error.message }, 400);\n  return c.body(null, 204);\n});\n\nexport default items;",
    "src/middleware/auth.ts": "import { createMiddleware } from 'hono/factory';\nimport { createClient } from '@supabase/supabase-js';\n\nexport const authMiddleware = createMiddleware<{\n  Variables: { userId: string };\n}>(async (c, next) => {\n  const authorization = c.req.header('Authorization');\n  if (!authorization?.startsWith('Bearer ')) {\n    return c.json({ error: 'Unauthorized' }, 401);\n  }\n  const token = authorization.slice(7);\n  const supabase = createClient(\n    process.env.SUPABASE_URL!,\n    process.env.SUPABASE_ANON_KEY!\n  );\n  const { data: { user }, error } = await supabase.auth.getUser(token);\n  if (error || !user) return c.json({ error: 'Invalid token' }, 401);\n  c.set('userId', user.id);\n  await next();\n});",
    "package.json": "{\n  \"name\": \"api-backend\",\n  \"version\": \"1.0.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"tsx watch src/index.ts\",\n    \"build\": \"tsc\",\n    \"start\": \"node dist/index.js\"\n  },\n  \"dependencies\": {\n    \"hono\": \"^4.4.0\",\n    \"@supabase/supabase-js\": \"^2.43.0\"\n  },\n  \"devDependencies\": {\n    \"tsx\": \"^4.15.0\",\n    \"typescript\": \"^5.4.0\"\n  }\n}"
  }$json$::jsonb,
  ARRAY['hono', 'supabase', 'typescript'],
  NOW()
);

-- ============================================================================
-- 4. Newsletter App
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Newsletter App',
  'newsletter',
  'Collect subscribers, send welcome emails via Resend, and manage your list from an admin view. Backed by Supabase.',
  'tool',
  ARRAY['newsletter', 'email', 'resend', 'supabase', 'nextjs'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "'use client';\nimport { useState } from 'react';\n\nexport default function SubscribePage() {\n  const [email, setEmail] = useState('');\n  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');\n\n  async function handleSubmit(e: React.FormEvent) {\n    e.preventDefault();\n    setStatus('loading');\n    const res = await fetch('/api/subscribe', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ email }),\n    });\n    setStatus(res.ok ? 'done' : 'error');\n  }\n\n  return (\n    <main className=\"min-h-screen flex items-center justify-center bg-gray-950 text-white px-4\">\n      <div className=\"max-w-md w-full text-center\">\n        <h1 className=\"text-4xl font-bold mb-4\">Stay in the loop</h1>\n        <p className=\"text-gray-400 mb-8\">Get the latest updates delivered to your inbox. No spam, ever.</p>\n        {status === 'done' ? (\n          <p className=\"text-green-400 font-medium\">You're subscribed! Check your inbox.</p>\n        ) : (\n          <form onSubmit={handleSubmit} className=\"flex gap-2\">\n            <input\n              type=\"email\"\n              required\n              placeholder=\"you@example.com\"\n              value={email}\n              onChange={(e) => setEmail(e.target.value)}\n              className=\"flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500\"\n            />\n            <button\n              type=\"submit\"\n              disabled={status === 'loading'}\n              className=\"bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 rounded-lg font-medium\"\n            >\n              {status === 'loading' ? '...' : 'Subscribe'}\n            </button>\n          </form>\n        )}\n        {status === 'error' && <p className=\"text-red-400 text-sm mt-2\">Something went wrong. Try again.</p>}\n      </div>\n    </main>\n  );\n}",
    "app/api/subscribe/route.ts": "import { NextRequest, NextResponse } from 'next/server';\nimport { createClient } from '@supabase/supabase-js';\nimport { resend } from '@/lib/resend';\n\nconst supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.SUPABASE_SERVICE_ROLE_KEY!\n);\n\nexport async function POST(req: NextRequest) {\n  const { email } = await req.json();\n  if (!email || !/^[^@]+@[^@]+\\.[^@]+$/.test(email)) {\n    return NextResponse.json({ error: 'Invalid email' }, { status: 422 });\n  }\n\n  const { error } = await supabase.from('subscribers').insert({ email });\n  if (error && error.code !== '23505') {\n    return NextResponse.json({ error: 'DB error' }, { status: 500 });\n  }\n\n  await resend.emails.send({\n    from: 'hello@yourdomain.com',\n    to: email,\n    subject: 'Welcome!',\n    html: '<h2>Thanks for subscribing!</h2><p>We will be in touch soon.</p>',\n  });\n\n  return NextResponse.json({ ok: true });\n}",
    "app/admin/page.tsx": "import { createClient } from '@supabase/supabase-js';\n\nexport const dynamic = 'force-dynamic';\n\nexport default async function AdminPage() {\n  const supabase = createClient(\n    process.env.NEXT_PUBLIC_SUPABASE_URL!,\n    process.env.SUPABASE_SERVICE_ROLE_KEY!\n  );\n  const { data } = await supabase\n    .from('subscribers')\n    .select('*')\n    .order('created_at', { ascending: false });\n\n  return (\n    <div className=\"p-8\">\n      <h1 className=\"text-2xl font-bold mb-6\">Subscribers ({data?.length ?? 0})</h1>\n      <table className=\"w-full text-sm border-collapse\">\n        <thead>\n          <tr className=\"border-b\">\n            <th className=\"text-left py-2\">Email</th>\n            <th className=\"text-left py-2\">Joined</th>\n          </tr>\n        </thead>\n        <tbody>\n          {data?.map((s) => (\n            <tr key={s.id} className=\"border-b hover:bg-gray-50\">\n              <td className=\"py-2\">{s.email}</td>\n              <td className=\"py-2 text-gray-500\">{new Date(s.created_at).toLocaleDateString()}</td>\n            </tr>\n          ))}\n        </tbody>\n      </table>\n    </div>\n  );\n}",
    "lib/resend.ts": "import { Resend } from 'resend';\n\nexport const resend = new Resend(process.env.RESEND_API_KEY!);"
  }$json$::jsonb,
  ARRAY['nextjs', 'supabase', 'resend'],
  NOW()
);

-- ============================================================================
-- 5. Portfolio + Blog
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Portfolio + Blog',
  'portfolio-blog',
  'Personal portfolio with project showcase and an MDX-powered blog. Clean, minimal, and SEO-ready.',
  'blog',
  ARRAY['portfolio', 'blog', 'mdx', 'nextjs', 'tailwind'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "import Link from 'next/link';\n\nconst projects = [\n  { name: 'Acme Analytics', desc: 'Real-time dashboard built with Next.js and D3.', url: '#', tech: ['Next.js', 'D3', 'Supabase'] },\n  { name: 'Clipr', desc: 'Screenshot-to-code tool powered by GPT-4 Vision.', url: '#', tech: ['React', 'OpenAI', 'Tailwind'] },\n  { name: 'Budgeteer', desc: 'Personal finance tracker with CSV import.', url: '#', tech: ['Next.js', 'Prisma', 'SQLite'] },\n];\n\nexport default function PortfolioPage() {\n  return (\n    <main className=\"max-w-2xl mx-auto px-6 py-16\">\n      <section className=\"mb-20\">\n        <h1 className=\"text-4xl font-bold mb-3\">Hey, I'm Alex.</h1>\n        <p className=\"text-lg text-gray-600\">I build products on the web — full stack engineer, occasional designer, and open-source enthusiast based in Berlin.</p>\n        <div className=\"flex gap-4 mt-6\">\n          <a href=\"https://github.com\" className=\"text-indigo-600 hover:underline\">GitHub</a>\n          <a href=\"https://twitter.com\" className=\"text-indigo-600 hover:underline\">Twitter</a>\n          <a href=\"mailto:alex@example.com\" className=\"text-indigo-600 hover:underline\">Email</a>\n        </div>\n      </section>\n      <section className=\"mb-16\">\n        <h2 className=\"text-2xl font-bold mb-6\">Projects</h2>\n        <div className=\"space-y-4\">\n          {projects.map((p) => (\n            <a key={p.name} href={p.url} className=\"block p-5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors\">\n              <h3 className=\"font-semibold\">{p.name}</h3>\n              <p className=\"text-sm text-gray-500 mt-1\">{p.desc}</p>\n              <div className=\"flex gap-2 mt-2\">{p.tech.map((t) => <span key={t} className=\"text-xs bg-gray-100 px-2 py-0.5 rounded\">{t}</span>)}</div>\n            </a>\n          ))}\n        </div>\n      </section>\n      <section>\n        <div className=\"flex items-center justify-between mb-6\">\n          <h2 className=\"text-2xl font-bold\">Writing</h2>\n          <Link href=\"/blog\" className=\"text-sm text-indigo-600 hover:underline\">All posts →</Link>\n        </div>\n        <p className=\"text-gray-500 text-sm\">Latest thoughts on code, design, and building things.</p>\n      </section>\n    </main>\n  );\n}",
    "app/blog/page.tsx": "import Link from 'next/link';\nimport { getAllPosts } from '@/lib/posts';\n\nexport default async function BlogPage() {\n  const posts = await getAllPosts();\n  return (\n    <main className=\"max-w-2xl mx-auto px-6 py-16\">\n      <Link href=\"/\" className=\"text-sm text-gray-400 hover:text-gray-600\">← Back</Link>\n      <h1 className=\"text-3xl font-bold mt-4 mb-10\">Writing</h1>\n      <div className=\"space-y-6\">\n        {posts.map((post) => (\n          <Link key={post.slug} href={`/blog/${post.slug}`} className=\"block group\">\n            <p className=\"text-xs text-gray-400 mb-1\">{post.date}</p>\n            <h2 className=\"font-semibold group-hover:text-indigo-600 transition-colors\">{post.title}</h2>\n            <p className=\"text-sm text-gray-500 mt-0.5\">{post.excerpt}</p>\n          </Link>\n        ))}\n      </div>\n    </main>\n  );\n}",
    "app/blog/[slug]/page.tsx": "import { getPostBySlug } from '@/lib/posts';\nimport { notFound } from 'next/navigation';\nimport { MDXRemote } from 'next-mdx-remote/rsc';\n\nexport default async function PostPage({ params }: { params: { slug: string } }) {\n  const post = await getPostBySlug(params.slug);\n  if (!post) notFound();\n  return (\n    <main className=\"max-w-2xl mx-auto px-6 py-16\">\n      <p className=\"text-xs text-gray-400 mb-2\">{post.date}</p>\n      <h1 className=\"text-4xl font-bold mb-8\">{post.title}</h1>\n      <article className=\"prose prose-gray max-w-none\">\n        <MDXRemote source={post.content} />\n      </article>\n    </main>\n  );\n}",
    "content/hello-world.mdx": "---\ntitle: Hello, World\ndate: 2025-01-01\nexcerpt: My first post. A quick intro to who I am and what I'll be writing about.\n---\n\n# Hello, World\n\nWelcome to my corner of the internet. I'm a full-stack developer who enjoys building tools that make developers' lives easier.\n\n## What I'll write about\n\n- **Side projects** — what I'm building and lessons learned\n- **Technical deep-dives** — going beyond the docs\n- **Career** — navigating the indie hacker path\n\nStay tuned."
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind', 'mdx'],
  NOW()
);

-- ============================================================================
-- 6. Link in Bio
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Link in Bio',
  'link-in-bio',
  'Minimal Linktree-style page with centered card, avatar, bio, and styled link buttons. Deploy in minutes.',
  'landing',
  ARRAY['linktree', 'links', 'profile', 'minimal', 'nextjs'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "import Image from 'next/image';\n\nconst links = [\n  { label: 'My Portfolio', url: 'https://yoursite.com', color: 'bg-indigo-600 hover:bg-indigo-700' },\n  { label: 'GitHub', url: 'https://github.com/yourusername', color: 'bg-gray-800 hover:bg-gray-700' },\n  { label: 'Twitter / X', url: 'https://twitter.com/yourhandle', color: 'bg-sky-500 hover:bg-sky-600' },\n  { label: 'Latest Article', url: 'https://dev.to/yourusername', color: 'bg-emerald-600 hover:bg-emerald-700' },\n  { label: 'Book a call', url: 'https://cal.com/yourhandle', color: 'bg-orange-500 hover:bg-orange-600' },\n];\n\nexport default function LinkInBioPage() {\n  return (\n    <main className=\"min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center px-4\">\n      <div className=\"w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center\">\n        <div className=\"w-20 h-20 rounded-full bg-indigo-200 mx-auto mb-4 overflow-hidden\">\n          {/* Replace src with your avatar */}\n          <div className=\"w-full h-full flex items-center justify-center text-3xl\">👤</div>\n        </div>\n        <h1 className=\"text-xl font-bold text-gray-900\">@yourhandle</h1>\n        <p className=\"text-sm text-gray-500 mt-1 mb-6\">\n          Full-stack developer · Building in public · Open source lover\n        </p>\n        <div className=\"space-y-3\">\n          {links.map((link) => (\n            <a\n              key={link.label}\n              href={link.url}\n              target=\"_blank\"\n              rel=\"noopener noreferrer\"\n              className={`block ${link.color} text-white font-medium py-3 px-5 rounded-xl transition-colors text-sm`}\n            >\n              {link.label}\n            </a>\n          ))}\n        </div>\n        <p className=\"text-xs text-gray-300 mt-8\">Made with Goblin</p>\n      </div>\n    </main>\n  );\n}",
    "app/layout.tsx": "import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: '@yourhandle',\n  description: 'All my links in one place',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind'],
  NOW()
);

-- ============================================================================
-- 7. Waitlist Page
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Waitlist Page',
  'waitlist',
  'Collect waitlist signups with a live counter and confetti celebration on submit. Backed by Supabase.',
  'landing',
  ARRAY['waitlist', 'launch', 'signup', 'supabase', 'nextjs'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "'use client';\nimport { useState, useEffect } from 'react';\n\nexport default function WaitlistPage() {\n  const [email, setEmail] = useState('');\n  const [count, setCount] = useState<number | null>(null);\n  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');\n\n  useEffect(() => {\n    fetch('/api/join')\n      .then((r) => r.json())\n      .then((d) => setCount(d.count))\n      .catch(() => {});\n  }, []);\n\n  async function handleSubmit(e: React.FormEvent) {\n    e.preventDefault();\n    setStatus('loading');\n    const res = await fetch('/api/join', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ email }),\n    });\n    if (res.ok) {\n      const d = await res.json();\n      setCount(d.count);\n      setStatus('done');\n      // Confetti\n      if (typeof window !== 'undefined') {\n        import('canvas-confetti').then((m) => m.default({ particleCount: 120, spread: 80, origin: { y: 0.6 } }));\n      }\n    } else {\n      setStatus('error');\n    }\n  }\n\n  return (\n    <main className=\"min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 text-center\">\n      <div className=\"inline-block bg-indigo-900 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide\">Coming soon</div>\n      <h1 className=\"text-5xl font-black mb-4\">Something awesome<br/>is loading.</h1>\n      <p className=\"text-gray-400 mb-8 max-w-md\">Join the waitlist and be the first to know when we launch. No spam — just one email.</p>\n      {count !== null && (\n        <p className=\"text-sm text-indigo-400 mb-4 font-medium\">{count.toLocaleString()} people already signed up</p>\n      )}\n      {status === 'done' ? (\n        <div className=\"bg-green-900/40 border border-green-700 text-green-300 px-6 py-4 rounded-xl\">\n          <p className=\"font-semibold\">You're on the list!</p>\n          <p className=\"text-sm mt-1\">We'll email you the moment we go live.</p>\n        </div>\n      ) : (\n        <form onSubmit={handleSubmit} className=\"flex w-full max-w-sm gap-2\">\n          <input\n            type=\"email\"\n            required\n            placeholder=\"your@email.com\"\n            value={email}\n            onChange={(e) => setEmail(e.target.value)}\n            className=\"flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500\"\n          />\n          <button\n            type=\"submit\"\n            disabled={status === 'loading'}\n            className=\"bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold\"\n          >\n            {status === 'loading' ? '...' : 'Join'}\n          </button>\n        </form>\n      )}\n      {status === 'error' && <p className=\"text-red-400 text-sm mt-3\">Something went wrong. Try again.</p>}\n    </main>\n  );\n}",
    "app/api/join/route.ts": "import { NextRequest, NextResponse } from 'next/server';\nimport { createClient } from '@supabase/supabase-js';\n\nconst supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.SUPABASE_SERVICE_ROLE_KEY!\n);\n\nexport async function GET() {\n  const { count } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });\n  return NextResponse.json({ count: count ?? 0 });\n}\n\nexport async function POST(req: NextRequest) {\n  const { email } = await req.json();\n  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 422 });\n\n  const { error } = await supabase.from('waitlist').insert({ email });\n  if (error && error.code !== '23505') {\n    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });\n  }\n\n  const { count } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });\n  return NextResponse.json({ ok: true, count: count ?? 0 });\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'supabase', 'tailwind'],
  NOW()
);

-- ============================================================================
-- 8. Dashboard Template
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Dashboard Template',
  'dashboard',
  'Admin dashboard with 4 stat cards, a Recharts line chart, and a data table. Ready to wire up to any data source.',
  'saas',
  ARRAY['dashboard', 'admin', 'charts', 'recharts', 'nextjs', 'tailwind'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "import StatsCard from '@/components/StatsCard';\nimport SimpleChart from '@/components/SimpleChart';\n\nconst stats = [\n  { title: 'Total Revenue', value: '$48,295', change: '+8.2%', positive: true },\n  { title: 'Active Users', value: '3,847', change: '+12.5%', positive: true },\n  { title: 'New Signups', value: '284', change: '+3.1%', positive: true },\n  { title: 'Churn Rate', value: '1.8%', change: '-0.4%', positive: true },\n];\n\nconst tableData = [\n  { name: 'Alice Johnson', email: 'alice@example.com', plan: 'Pro', status: 'Active', revenue: '$290' },\n  { name: 'Bob Martinez', email: 'bob@example.com', plan: 'Starter', status: 'Active', revenue: '$9' },\n  { name: 'Clara Lee', email: 'clara@example.com', plan: 'Pro', status: 'Churned', revenue: '$0' },\n  { name: 'David Park', email: 'david@example.com', plan: 'Enterprise', status: 'Active', revenue: '$990' },\n  { name: 'Eva Brown', email: 'eva@example.com', plan: 'Pro', status: 'Active', revenue: '$290' },\n];\n\nexport default function DashboardPage() {\n  return (\n    <div className=\"min-h-screen bg-gray-50 p-8\">\n      <div className=\"max-w-6xl mx-auto\">\n        <h1 className=\"text-2xl font-bold text-gray-900 mb-8\">Overview</h1>\n\n        <div className=\"grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8\">\n          {stats.map((s) => <StatsCard key={s.title} {...s} />)}\n        </div>\n\n        <div className=\"bg-white rounded-2xl border border-gray-200 p-6 mb-8\">\n          <h2 className=\"text-lg font-semibold mb-4\">Revenue over time</h2>\n          <SimpleChart />\n        </div>\n\n        <div className=\"bg-white rounded-2xl border border-gray-200 overflow-hidden\">\n          <div className=\"px-6 py-4 border-b border-gray-100\">\n            <h2 className=\"text-lg font-semibold\">Recent Customers</h2>\n          </div>\n          <table className=\"w-full text-sm\">\n            <thead className=\"bg-gray-50 text-gray-500\">\n              <tr>\n                {['Name', 'Email', 'Plan', 'Status', 'Revenue'].map((h) => (\n                  <th key={h} className=\"text-left px-6 py-3 font-medium\">{h}</th>\n                ))}\n              </tr>\n            </thead>\n            <tbody className=\"divide-y divide-gray-100\">\n              {tableData.map((row) => (\n                <tr key={row.email} className=\"hover:bg-gray-50\">\n                  <td className=\"px-6 py-3 font-medium\">{row.name}</td>\n                  <td className=\"px-6 py-3 text-gray-500\">{row.email}</td>\n                  <td className=\"px-6 py-3\">{row.plan}</td>\n                  <td className=\"px-6 py-3\">\n                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${\n                      row.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'\n                    }`}>{row.status}</span>\n                  </td>\n                  <td className=\"px-6 py-3 font-medium\">{row.revenue}</td>\n                </tr>\n              ))}\n            </tbody>\n          </table>\n        </div>\n      </div>\n    </div>\n  );\n}",
    "components/StatsCard.tsx": "interface StatsCardProps {\n  title: string;\n  value: string;\n  change: string;\n  positive: boolean;\n}\n\nexport default function StatsCard({ title, value, change, positive }: StatsCardProps) {\n  return (\n    <div className=\"bg-white rounded-2xl border border-gray-200 p-5\">\n      <p className=\"text-sm text-gray-500 font-medium\">{title}</p>\n      <p className=\"text-2xl font-bold text-gray-900 mt-1\">{value}</p>\n      <p className={`text-xs font-medium mt-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>\n        {change} vs last month\n      </p>\n    </div>\n  );\n}",
    "components/SimpleChart.tsx": "'use client';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\n\nconst data = [\n  { month: 'Jan', revenue: 4200 },\n  { month: 'Feb', revenue: 5800 },\n  { month: 'Mar', revenue: 5100 },\n  { month: 'Apr', revenue: 7300 },\n  { month: 'May', revenue: 8100 },\n  { month: 'Jun', revenue: 9400 },\n  { month: 'Jul', revenue: 8800 },\n];\n\nexport default function SimpleChart() {\n  return (\n    <ResponsiveContainer width=\"100%\" height={260}>\n      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>\n        <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#f0f0f0\" />\n        <XAxis dataKey=\"month\" tick={{ fontSize: 12, fill: '#9ca3af' }} />\n        <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />\n        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />\n        <Line type=\"monotone\" dataKey=\"revenue\" stroke=\"#6366f1\" strokeWidth={2} dot={false} />\n      </LineChart>\n    </ResponsiveContainer>\n  );\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind', 'recharts'],
  NOW()
);

-- ============================================================================
-- 9. AI Chat App
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'AI Chat App',
  'ai-chat',
  'Streaming chat interface powered by OpenAI GPT-4o. Message bubbles, auto-scroll, and keyboard-friendly input.',
  'tool',
  ARRAY['ai', 'chat', 'openai', 'streaming', 'gpt', 'nextjs'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "'use client';\nimport { useState, useRef, useEffect } from 'react';\nimport Message from '@/components/Message';\n\ntype Msg = { role: 'user' | 'assistant'; content: string };\n\nexport default function ChatPage() {\n  const [messages, setMessages] = useState<Msg[]>([]);\n  const [input, setInput] = useState('');\n  const [loading, setLoading] = useState(false);\n  const bottomRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });\n  }, [messages, loading]);\n\n  async function sendMessage(e: React.FormEvent) {\n    e.preventDefault();\n    if (!input.trim() || loading) return;\n    const userMsg: Msg = { role: 'user', content: input.trim() };\n    setMessages((prev) => [...prev, userMsg]);\n    setInput('');\n    setLoading(true);\n\n    const res = await fetch('/api/chat', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ messages: [...messages, userMsg] }),\n    });\n\n    const reader = res.body!.getReader();\n    const decoder = new TextDecoder();\n    let assistantText = '';\n    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);\n\n    while (true) {\n      const { done, value } = await reader.read();\n      if (done) break;\n      assistantText += decoder.decode(value);\n      setMessages((prev) => [\n        ...prev.slice(0, -1),\n        { role: 'assistant', content: assistantText },\n      ]);\n    }\n    setLoading(false);\n  }\n\n  return (\n    <div className=\"flex flex-col h-screen bg-gray-950\">\n      <header className=\"px-6 py-4 border-b border-gray-800\">\n        <h1 className=\"text-white font-semibold\">AI Assistant</h1>\n      </header>\n      <div className=\"flex-1 overflow-y-auto px-4 py-6 space-y-4\">\n        {messages.length === 0 && (\n          <p className=\"text-center text-gray-500 mt-20\">Start a conversation below.</p>\n        )}\n        {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}\n        {loading && messages[messages.length - 1]?.role !== 'assistant' && (\n          <Message role=\"assistant\" content=\"...\" />\n        )}\n        <div ref={bottomRef} />\n      </div>\n      <form onSubmit={sendMessage} className=\"px-4 pb-6\">\n        <div className=\"flex gap-2 max-w-3xl mx-auto\">\n          <input\n            value={input}\n            onChange={(e) => setInput(e.target.value)}\n            placeholder=\"Ask me anything...\"\n            className=\"flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500\"\n          />\n          <button\n            type=\"submit\"\n            disabled={loading || !input.trim()}\n            className=\"bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-medium\"\n          >\n            Send\n          </button>\n        </div>\n      </form>\n    </div>\n  );\n}",
    "app/api/chat/route.ts": "import { NextRequest } from 'next/server';\nimport OpenAI from 'openai';\n\nconst openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\n\nexport async function POST(req: NextRequest) {\n  const { messages } = await req.json();\n\n  const stream = await openai.chat.completions.create({\n    model: 'gpt-4o',\n    messages: [\n      { role: 'system', content: 'You are a helpful assistant.' },\n      ...messages,\n    ],\n    stream: true,\n  });\n\n  const encoder = new TextEncoder();\n  const readable = new ReadableStream({\n    async start(controller) {\n      for await (const chunk of stream) {\n        const text = chunk.choices[0]?.delta?.content ?? '';\n        if (text) controller.enqueue(encoder.encode(text));\n      }\n      controller.close();\n    },\n  });\n\n  return new Response(readable, {\n    headers: { 'Content-Type': 'text/plain; charset=utf-8' },\n  });\n}",
    "components/Message.tsx": "interface MessageProps {\n  role: 'user' | 'assistant';\n  content: string;\n}\n\nexport default function Message({ role, content }: MessageProps) {\n  const isUser = role === 'user';\n  return (\n    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-3xl mx-auto w-full`}>\n      <div\n        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${\n          isUser\n            ? 'bg-indigo-600 text-white rounded-br-sm'\n            : 'bg-gray-800 text-gray-100 rounded-bl-sm'\n        }`}\n      >\n        {content}\n      </div>\n    </div>\n  );\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'openai', 'tailwind'],
  NOW()
);

-- ============================================================================
-- 10. Blank Canvas
-- ============================================================================
INSERT INTO templates (id, name, slug, description, category, tags, thumbnail_url, author_id, is_official, is_public, downloads, files, tech_stack, created_at)
VALUES (
  gen_random_uuid(),
  'Blank Canvas',
  'blank',
  'Bare-minimum Next.js 15 + Tailwind setup. No opinions, no extra dependencies. Just a clean slate.',
  'tool',
  ARRAY['blank', 'minimal', 'starter', 'nextjs', 'tailwind'],
  NULL,
  NULL,
  true,
  true,
  0,
  $json${
    "app/page.tsx": "export default function HomePage() {\n  return (\n    <main className=\"flex min-h-screen items-center justify-center bg-white\">\n      <div className=\"text-center\">\n        <h1 className=\"text-4xl font-bold text-gray-900 mb-3\">Hello, world.</h1>\n        <p className=\"text-gray-400\">Your project starts here. Edit <code className=\"bg-gray-100 px-1.5 py-0.5 rounded text-sm\">app/page.tsx</code> to begin.</p>\n      </div>\n    </main>\n  );\n}",
    "app/layout.tsx": "import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: 'My App',\n  description: 'Built with Next.js and Tailwind',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body className=\"antialiased\">{children}</body>\n    </html>\n  );\n}",
    "tailwind.config.ts": "import type { Config } from 'tailwindcss';\n\nconst config: Config = {\n  content: [\n    './app/**/*.{ts,tsx}',\n    './components/**/*.{ts,tsx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n\nexport default config;",
    "package.json": "{\n  \"name\": \"my-app\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"next dev\",\n    \"build\": \"next build\",\n    \"start\": \"next start\",\n    \"lint\": \"next lint\"\n  },\n  \"dependencies\": {\n    \"next\": \"15.0.0\",\n    \"react\": \"^19.0.0\",\n    \"react-dom\": \"^19.0.0\"\n  },\n  \"devDependencies\": {\n    \"@types/node\": \"^20\",\n    \"@types/react\": \"^19\",\n    \"@types/react-dom\": \"^19\",\n    \"tailwindcss\": \"^3.4.0\",\n    \"postcss\": \"^8\",\n    \"autoprefixer\": \"^10\",\n    \"typescript\": \"^5\"\n  }\n}"
  }$json$::jsonb,
  ARRAY['nextjs', 'tailwind'],
  NOW()
);
