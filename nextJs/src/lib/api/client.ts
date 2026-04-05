import { supabase } from '@/lib/supabaseClient';

const DEFAULT_API_URL = 'http://localhost:3001';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

type ApiPrimitive = string | number | boolean | null;
type ApiBody =
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | FormData
  | ApiPrimitive;

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  userId?: string;
  accessToken?: string;
  headers?: HeadersInit;
  body?: ApiBody;
  cache?: RequestCache;
}

interface AuthContext {
  accessToken?: string;
  userId?: string;
}

async function getAuthContext(
  options: Pick<ApiRequestOptions, 'userId' | 'accessToken'> = {},
): Promise<AuthContext> {
  // Se o token for passado explicitamente nas opções, respeitamos
  if (options.accessToken) {
    return {
      accessToken: options.accessToken,
      userId: options.userId,
    };
  }

  // No servidor (SSR/ISR) sem token explícito, não temos acesso à sessão global do window
  if (typeof window === 'undefined') {
    return { userId: options.userId };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      accessToken: session?.access_token,
      userId: options.userId || session?.user.id,
    };
  } catch (error) {
    console.error('Erro ao obter contexto de autenticação:', error);
    return { userId: options.userId };
  }
}

function buildHeaders(
  options: ApiRequestOptions,
  authContext: AuthContext,
) {
  const headers = new Headers(options.headers);

  if (authContext.accessToken) {
    headers.set('Authorization', `Bearer ${authContext.accessToken}`);
  }

  if (authContext.userId) {
    headers.set('x-user-id', authContext.userId);
  }

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function serializeBody(body: ApiBody | undefined) {
  if (body === undefined || body instanceof FormData) {
    return body;
  }

  return typeof body === 'string' ? body : JSON.stringify(body);
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const authContext = await getAuthContext(options);
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: buildHeaders(options, authContext),
    body: serializeBody(options.body),
    cache: options.cache ?? 'no-store',
  });

  const payload = await response
    .json()
    .catch(() => null) as T | { message?: string } | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : 'Falha na comunicação com o servidor.';

    throw new Error(message);
  }

  return payload as T;
}

export function createUserFetcher<T>(path: string) {
  return (_key: readonly unknown[], userId: string) =>
    apiRequest<T>(path, { userId });
}

export async function getAuthenticatedHeaders(
  options: Pick<ApiRequestOptions, 'userId' | 'accessToken' | 'headers'> = {},
) {
  const authContext = await getAuthContext(options);
  return buildHeaders(options, authContext);
}

export async function apiFetch(
  path: string,
  options: ApiRequestOptions = {},
) {
  const authContext = await getAuthContext(options);

  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: buildHeaders(options, authContext),
    body: serializeBody(options.body),
    cache: options.cache ?? 'no-store',
  });
}
