import { ApiError } from './ApiError.js';

const accessTokenKey = 'lms.accessToken';
const refreshTokenKey = 'lms.refreshToken';
const sessionUserKey = 'lms.user';
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
let refreshPromise;

function storage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function getAccessToken() {
  return storage()?.getItem(accessTokenKey) ?? null;
}

export function getRefreshToken() {
  return storage()?.getItem(refreshTokenKey) ?? null;
}

export function saveSession({ accessToken, refreshToken, user }) {
  const localStorage = storage();
  if (!localStorage) return;

  if (accessToken) localStorage.setItem(accessTokenKey, accessToken);
  if (refreshToken) localStorage.setItem(refreshTokenKey, refreshToken);
  if (user) {
    let previousUser = {};
    try {
      previousUser = JSON.parse(localStorage.getItem(sessionUserKey) || '{}');
    } catch {
      previousUser = {};
    }
    localStorage.setItem(sessionUserKey, JSON.stringify({ ...previousUser, ...user }));
  }
}

export function getStoredUser() {
  const value = storage()?.getItem(sessionUserKey);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    storage()?.removeItem(sessionUserKey);
    return null;
  }
}

export function clearSession() {
  const localStorage = storage();
  localStorage?.removeItem(accessTokenKey);
  localStorage?.removeItem(refreshTokenKey);
  localStorage?.removeItem(sessionUserKey);
}

function emitUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lms:unauthorized'));
  }
}

function buildUrl(path, params) {
  const base = baseURL.replace(/\/+$/, '');
  const absoluteBase = /^https?:\/\//i.test(base);
  const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path;
  const url = /^https?:\/\//i.test(path)
    ? new URL(path)
    : new URL(`${base}/${normalizedPath.replace(/^\/+/, '')}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, String(entry)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return /^https?:\/\//i.test(path) || absoluteBase
    ? url.toString()
    : `${url.pathname}${url.search}`;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

async function toApiError(response) {
  let payload;
  try {
    payload = await parseResponse(response);
  } catch {
    payload = null;
  }

  return new ApiError({
    code: payload?.code,
    details: payload?.details,
    message: payload?.message,
    status: response.status
  });
}

function authEndpoint(path) {
  return /\/auth\/(login|refresh|logout)(?:\?|$)/.test(path);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const token = getRefreshToken();
  if (!token) throw new ApiError({ status: 401, code: 'UNAUTHORIZED' });

  refreshPromise = (async () => {
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token })
    });

    if (!response.ok) throw await toApiError(response);

    const session = await response.json();
    saveSession(session);
    return session.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = undefined;
  }
}

async function fetchWithAuth(url, init, path, canRefresh = true) {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: error.message || 'Không thể kết nối tới máy chủ.',
      status: null
    });
  }

  if (response.status !== 401) return response;
  const apiError = await toApiError(response);

  if (canRefresh && !authEndpoint(path)) {
    try {
      await refreshAccessToken();
      return fetchWithAuth(url, init, path, false);
    } catch {
      clearSession();
      emitUnauthorized();
      throw apiError;
    }
  }

  if (!authEndpoint(path)) {
    clearSession();
    emitUnauthorized();
  }
  throw apiError;
}

async function request(method, path, body, options = {}) {
  const url = buildUrl(path, options.params);
  const headers = new Headers(options.headers);
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !(body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetchWithAuth(
    url,
    {
      method,
      headers,
      body: hasBody ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      signal: options.signal
    },
    path
  );

  if (!response.ok) throw await toApiError(response);
  return parseResponse(response);
}

function uploadRequest(path, formData, options = {}, canRefresh = true) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = buildUrl(path, options.params);
    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    Object.entries(options.headers || {}).forEach(([name, value]) => {
      xhr.setRequestHeader(name, value);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100)
        });
      }
    });
    xhr.addEventListener('load', async () => {
      let payload;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = xhr.responseText;
      }

      if (xhr.status === 401 && canRefresh && !authEndpoint(path)) {
        try {
          await refreshAccessToken();
          resolve(await uploadRequest(path, formData, options, false));
        } catch {
          clearSession();
          emitUnauthorized();
          reject(
            new ApiError({
              code: payload?.code,
              details: payload?.details,
              message: payload?.message,
              status: 401
            })
          );
        }
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 401 && !authEndpoint(path)) {
          clearSession();
          emitUnauthorized();
        }
        reject(
          new ApiError({
            code: payload?.code,
            details: payload?.details,
            message: payload?.message || xhr.statusText,
            status: xhr.status || null
          })
        );
        return;
      }
      resolve(payload);
    });
    xhr.addEventListener('error', () => {
      reject(
        new ApiError({
          code: 'NETWORK_ERROR',
          message: 'Không thể kết nối tới máy chủ.',
          status: null
        })
      );
    });
    xhr.addEventListener('abort', () => {
      reject(new ApiError({ code: 'REQUEST_ABORTED', message: 'Yêu cầu đã bị hủy.' }));
    });

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(formData);
  });
}

function download(path, { filename, params, signal, headers } = {}) {
  return fetchWithAuth(
    buildUrl(path, params),
    { method: 'GET', headers, signal },
    path
  ).then(async (response) => {
    if (!response.ok) throw await toApiError(response);

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    const filenameMatch = disposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const resolvedFilename =
      filename ||
      (filenameMatch
        ? decodeURIComponent(filenameMatch[1] || filenameMatch[2])
        : 'download');
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = resolvedFilename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return { blob, filename: resolvedFilename };
  });
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
  upload: uploadRequest,
  download
};
