import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/organisms/LoadingState.jsx';
import { useAuth } from './useAuth.js';

export function RequireAuth({ roles = [], children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles.length && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
