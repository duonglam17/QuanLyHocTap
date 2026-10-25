import { Navigate } from 'react-router-dom';
import { LoadingState } from '../../shared/components/organisms/LoadingState.jsx';
import { useAuth } from '../../shared/auth/useAuth.js';

export function HomeRedirect({ routes }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;

  const accessibleRoutes = routes.filter(
    (route) => !route.public && (!route.roles.length || route.roles.includes(user.role))
  );
  const destination =
    accessibleRoutes.find((route) => route.homeFor?.includes(user.role)) ??
    accessibleRoutes
      .filter((route) => typeof route.nav?.order === 'number')
      .sort((left, right) => left.nav.order - right.nav.order)[0] ??
    accessibleRoutes[0];

  return <Navigate to={destination?.path ?? '/forbidden'} replace />;
}
