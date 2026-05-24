/**
 * Workaround: en Expo SDK 54, fetch nativo en Android (Hermes) puede fallar con
 * "Network request failed" aunque Supabase sea alcanzable desde el PC.
 * @see https://github.com/expo/expo/issues/40061
 */
import { Platform } from 'react-native';

function parseXhrHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
  }
  return headers;
}

function resolveRequest(input: RequestInfo | URL, init?: RequestInit): {
  url: string;
  method: string;
  headers: HeadersInit | undefined;
  body: BodyInit | null | undefined;
} {
  if (input instanceof Request) {
    return {
      url: input.url,
      method: (init?.method ?? input.method) || 'GET',
      headers: init?.headers ?? input.headers,
      body: init?.body !== undefined ? init.body : input.body,
    };
  }
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
  return {
    url,
    method: init?.method ?? 'GET',
    headers: init?.headers,
    body: init?.body,
  };
}

function applyHeaders(xhr: XMLHttpRequest, headers: HeadersInit | undefined): void {
  if (!headers) return;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    return;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) xhr.setRequestHeader(key, value);
    return;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value != null) xhr.setRequestHeader(key, String(value));
  }
}

function xhrFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { url, method, headers, body } = resolveRequest(input, init);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = 60_000;
    applyHeaders(xhr, headers);

    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText ?? '', {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseXhrHeaders(xhr.getAllResponseHeaders()),
        }),
      );
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request failed'));

    try {
      xhr.send(body ?? null);
    } catch (err) {
      reject(err);
    }
  });
}

/** Fetch para Supabase: XHR en Android, nativo en iOS/web. */
export function fetchForSupabase(): typeof fetch {
  if (Platform.OS === 'android') {
    return xhrFetch as typeof fetch;
  }
  return globalThis.fetch.bind(globalThis);
}
