type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function api<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(url, config);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, errorBody.error || 'Request failed', errorBody.details);
  }

  return res.json();
}

export const apiClient = {
  get: <T>(url: string) => api<T>(url),
  post: <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body }),
  patch: <T>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body }),
  put: <T>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body }),
  delete: <T>(url: string) => api<T>(url, { method: 'DELETE' }),
};
