import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('shared API client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends bearer credentials, serializes JSON, and returns parsed data', async () => {
    localStorage.setItem('lms.accessToken', 'access-token');
    fetch.mockResolvedValue(jsonResponse({ success: true }));

    await expect(api.post('/assignments', { title: 'Bài tập' })).resolves.toEqual({
      success: true
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/assignments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Bài tập' }),
        headers: expect.any(Headers)
      })
    );
    expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('refreshes a session once after a protected request returns 401', async () => {
    localStorage.setItem('lms.accessToken', 'expired-access');
    localStorage.setItem('lms.refreshToken', 'refresh-token');
    fetch
      .mockResolvedValueOnce(jsonResponse({ code: 'EXPIRED', message: 'Hết phiên' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          user: { id: 3, role: 'SINH_VIEN' }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    await expect(api.get('/assignments')).resolves.toEqual({ items: [] });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('lms.accessToken')).toBe('new-access');
    expect(localStorage.getItem('lms.refreshToken')).toBe('new-refresh');
    expect(localStorage.getItem('lms.user')).toContain('"id":3');
  });

  it('preserves the server validation envelope in ApiError', async () => {
    fetch.mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          details: [{ field: 'title', message: 'Tiêu đề là bắt buộc' }]
        },
        422
      )
    );

    await expect(api.post('/assignments', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'title', message: 'Tiêu đề là bắt buộc' }]
    });
  });

  it('returns null for a successful 204 response', async () => {
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete('/assignments/1')).resolves.toBeNull();
  });

  it('reports upload progress and parses the upload response', async () => {
    class MockXMLHttpRequest {
      constructor() {
        this.listeners = {};
        this.uploadListeners = {};
        this.upload = {
          addEventListener: (name, callback) => {
            this.uploadListeners[name] = callback;
          }
        };
      }

      open(method, url) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader() {}

      addEventListener(name, callback) {
        this.listeners[name] = callback;
      }

      send() {
        this.uploadListeners.progress({ lengthComputable: true, loaded: 25, total: 100 });
        this.status = 201;
        this.responseText = JSON.stringify({ id: 5 });
        this.listeners.load();
      }
    }
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
    const onProgress = vi.fn();

    await expect(api.upload('/assignments/1/submissions', new FormData(), { onProgress })).resolves.toEqual({
      id: 5
    });
    expect(onProgress).toHaveBeenCalledWith({ loaded: 25, total: 100, percentage: 25 });
  });

  it('downloads a protected file and uses the response filename', async () => {
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:lms-file')
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    localStorage.setItem('lms.accessToken', 'download-token');
    fetch.mockResolvedValue(
      new Response(new Blob(['bài làm']), {
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="bai-lam.pdf"',
          'Content-Type': 'application/pdf'
        }
      })
    );

    try {
      await expect(api.download('/submissions/1/download')).resolves.toMatchObject({
        filename: 'bai-lam.pdf'
      });
      expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer download-token');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lms-file');
    } finally {
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
      else delete URL.createObjectURL;
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
      else delete URL.revokeObjectURL;
    }
  });
});
