import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // @ts-ignore
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single() as unknown as { data: { is_admin: boolean } | null };

  return !!data?.is_admin;
}

async function proxyRequest(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targetPath = pathSegments.join('/');
  const url = new URL(request.url);
  const targetUrl = `${API_BASE}/api/admin/${targetPath}${url.search}`;

  const headers: Record<string, string> = {
    'x-admin-key': ADMIN_API_KEY,
    'Content-Type': 'application/json',
  };

  const init: RequestInit = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const res = await fetch(targetUrl, init);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Admin API unavailable' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}
