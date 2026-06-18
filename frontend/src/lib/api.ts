import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Resolves request headers, automatically appending the Supabase Authorization token if present.
 */
async function getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Handles API fetch responses and parses potential JSON errors.
 */
async function handleResponse(response: Response) {
  if (!response.ok) {
    let errorMsg = `HTTP error! Status: ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorMsg;
    } catch {
      // Response was not JSON
      try {
        const text = await response.text();
        if (text) errorMsg = text;
      } catch {}
    }
    throw new Error(errorMsg);
  }

  // Handle empty responses
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null; // Response wasn't JSON but succeeded
  }
}

/**
 * GET Request
 */
export async function apiGet<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  const requestHeaders = await getHeaders(headers);
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: requestHeaders
  });
  return handleResponse(response) as Promise<T>;
}

/**
 * POST Request
 */
export async function apiPost<T>(endpoint: string, body: any = {}, headers: Record<string, string> = {}): Promise<T> {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  const requestHeaders = await getHeaders(headers);
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body)
  });
  return handleResponse(response) as Promise<T>;
}

/**
 * PATCH Request
 */
export async function apiPatch<T>(endpoint: string, body: any = {}, headers: Record<string, string> = {}): Promise<T> {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  const requestHeaders = await getHeaders(headers);
  const response = await fetch(fullUrl, {
    method: 'PATCH',
    headers: requestHeaders,
    body: JSON.stringify(body)
  });
  return handleResponse(response) as Promise<T>;
}

/**
 * DELETE Request
 */
export async function apiDelete<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  const requestHeaders = await getHeaders(headers);
  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers: requestHeaders
  });
  return handleResponse(response) as Promise<T>;
}
