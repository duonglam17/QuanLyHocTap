import { useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);

  useEffect(() => {
    const clearSession = () => setUser(null);
    window.addEventListener('lms:unauthorized', clearSession);
    return () => window.removeEventListener('lms:unauthorized', clearSession);
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
