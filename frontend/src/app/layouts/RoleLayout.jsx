import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Users,
  X
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/atoms/Button.jsx';
import { useAuth } from '../../shared/auth/useAuth.js';
import { getHeaderWidgets } from '../../shared/lib/slots.js';
import { toast } from '../../shared/components/molecules/Toast.jsx';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

const iconMap = {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Users
};

const groupLabels = {
  main: 'Không gian học tập',
  management: 'Quản trị'
};

function isVisibleForRole(route, role) {
  const routeAllowsRole = !route.roles.length || route.roles.includes(role);
  const navAllowsRole =
    !Array.isArray(route.nav.roles) ||
    route.nav.roles.length === 0 ||
    route.nav.roles.includes(role);
  return routeAllowsRole && navAllowsRole;
}

function Sidebar({ routes, role, open, onNavigate }) {
  const navigation = useMemo(
    () =>
      routes
        .filter((route) => route.nav && isVisibleForRole(route, role))
        .sort((left, right) => (left.nav.order ?? 0) - (right.nav.order ?? 0)),
    [routes, role]
  );
  const groups = navigation.reduce((result, route) => {
    const group = route.nav.group ?? 'main';
    result[group] ??= [];
    result[group].push(route);
    return result;
  }, {});

  return (
    <aside
      aria-label="Điều hướng chính"
      className={`${open ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-b border-border bg-card p-3 md:flex md:w-64 md:border-b-0 md:border-r`}
    >
      <nav className="grid gap-5">
        {Object.entries(groups).map(([group, items]) => (
          <section className="grid gap-2" key={group}>
            <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {groupLabels[group] ?? group}
            </h2>
            {items.map((route) => {
              const Icon = iconMap[route.nav.icon] ?? BookOpen;
              return (
                <NavLink
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`
                  }
                  end
                  key={route.path}
                  onClick={onNavigate}
                  to={route.path}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {route.nav.label}
                </NavLink>
              );
            })}
          </section>
        ))}
        {navigation.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">Chưa có mục điều hướng phù hợp.</p>
        ) : null}
      </nav>
    </aside>
  );
}

function Topbar({ user, role, widgets, onLogout, onToggleNavigation, navigationOpen }) {
  const displayName = user?.fullName || user?.username || 'Người dùng';
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-expanded={navigationOpen}
            aria-label={navigationOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
            className="md:hidden"
            onClick={onToggleNavigation}
            size="icon"
            variant="ghost"
          >
            {navigationOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Link className="shrink-0 font-semibold text-primary" to="/">
            LMS Mini
          </Link>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            {widgets.map(({ moduleName, Component }) => (
              <div key={moduleName}>
                <Component />
              </div>
            ))}
          </div>
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[role] ?? role}</p>
          </div>
          <Button onClick={onLogout} size="sm" variant="outline">
            Đăng xuất
          </Button>
        </div>
      </div>
      {widgets.length > 0 ? (
        <div className="flex gap-2 border-t border-border px-4 py-2 sm:hidden">
          {widgets.map(({ moduleName, Component }) => (
            <div key={moduleName}><Component /></div>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function RoleLayout({ children, routes = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const widgets = useMemo(() => getHeaderWidgets(user?.role), [user?.role]);

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      toast.error(error.message || 'Không thể kết thúc phiên trên máy chủ.');
    }
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar
        navigationOpen={navigationOpen}
        onLogout={handleLogout}
        onToggleNavigation={() => setNavigationOpen((current) => !current)}
        role={user?.role}
        user={user}
        widgets={widgets}
      />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <Sidebar
          onNavigate={() => setNavigationOpen(false)}
          open={navigationOpen}
          role={user?.role}
          routes={routes}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
