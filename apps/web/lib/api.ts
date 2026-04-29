import { createClient } from './supabase/client';

export async function apiCall(path: string, options?: RequestInit) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  return fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options?.headers
    }
  });
}

// Helper functions for common API operations
export async function apiGet(path: string, options?: RequestInit) {
  return apiCall(path, { method: 'GET', ...options });
}

export async function apiPost(path: string, body?: any, options?: RequestInit) {
  return apiCall(path, { 
    method: 'POST', 
    body: body ? JSON.stringify(body) : undefined,
    ...options 
  });
}

export async function apiPut(path: string, body?: any, options?: RequestInit) {
  return apiCall(path, { 
    method: 'PUT', 
    body: body ? JSON.stringify(body) : undefined,
    ...options 
  });
}

export async function apiDelete(path: string, options?: RequestInit) {
  return apiCall(path, { method: 'DELETE', ...options });
}