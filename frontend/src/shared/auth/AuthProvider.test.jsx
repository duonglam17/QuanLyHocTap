import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider.jsx';
import { useAuth } from './useAuth.js';

describe('AuthProvider', () => {
  it('authenticates, stores tokens, and exposes the contract user shape', async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: 'access',
            refreshToken: 'refresh',
            user: { id: 12, role: 'GIANG_VIEN', must_change_password: false }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    await act(async () => result.current.login('gv_mai', 'MatKhau@123'));

    expect(result.current.user).toEqual({
      id: 12,
      fullName: '',
      username: 'gv_mai',
      role: 'GIANG_VIEN'
    });
    expect(result.current.hasRole('GIANG_VIEN')).toBe(true);
    expect(localStorage.getItem('lms.accessToken')).toBe('access');
    expect(localStorage.getItem('lms.refreshToken')).toBe('refresh');
  });
});
