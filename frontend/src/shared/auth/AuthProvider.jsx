import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getAccessToken, getRefreshToken, getStoredUser, saveSession } from '../api/index.js';
import { AuthContext } from './authContext.js';

function normalizeUser(user, previousUser, identifier) {
  return {
    id: user.id,
    fullName: user.fullName ?? user.full_name ?? previousUser?.fullName ?? '',
    username: user.username ?? previousUser?.username ?? identifier ?? '',
    role: user.role
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const applySession = useCallback((session, previousUser, identifier) => {
    const normalizedUser = normalizeUser(session.user, previousUser, identifier);
    saveSession({ ...session, user: normalizedUser });
    setUser(normalizedUser);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (username, password) => {
      const session = await api.post('/auth/login', { username, password });
      applySession(session, null, username.trim());
      return session.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await api.post('/auth/logout');
    } finally {
      clearSession();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const hasRole = useCallback(
    (...roles) => Boolean(user && roles.includes(user.role)),
    [user]
  );

  useEffect(() => {
    let active = true;
    const storedUser = getStoredUser();

    async function restoreSession() {
      if (!getRefreshToken()) {
        if (active) {
          clearSession();
          setStatus('anonymous');
        }
        return;
      }

      try {
        const session = await api.post('/auth/refresh', {
          refreshToken: getRefreshToken()
        });
        if (active) applySession(session, storedUser);
      } catch {
        clearSession();
        if (active) {
          setUser(null);
          setStatus('anonymous');
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [applySession]);

  useEffect(() => {
    const clearExpiredSession = () => {
      clearSession();
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('lms:unauthorized', clearExpiredSession);
    return () => window.removeEventListener('lms:unauthorized', clearExpiredSession);
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, hasRole }),
    [user, status, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
