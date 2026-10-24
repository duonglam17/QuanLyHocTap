import { Navigate } from 'react-router-dom';
import { LoadingState } from '../../shared/components/organisms/LoadingState.jsx';
import { useAuth } from '../../shared/auth/useAuth.js';

export function HomeRedirect({ routes }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;

  const destination = routes.find(
    (route) => !route.public && (!route.roles.length || route.roles.includes(user.role))
  );
  return <Navigate to={destination?.path ?? '/forbidden'} replace />;
}
