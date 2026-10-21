import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';

const roleLabels = {
  ADMIN: 'Quản trị viên',
  GIANG_VIEN: 'Giảng viên',
  SINH_VIEN: 'Sinh viên'
};

function LayoutFrame({ roleLabel, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="font-semibold text-primary" to="/">
            LMS Mini
          </Link>
          <span className="text-sm text-muted-foreground">{roleLabel}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children ?? <Outlet />}</main>
    </div>
  );
}

export function AdminLayout({ children }) {
  return <LayoutFrame roleLabel={roleLabels.ADMIN}>{children}</LayoutFrame>;
}

export function InstructorLayout({ children }) {
  return <LayoutFrame roleLabel={roleLabels.GIANG_VIEN}>{children}</LayoutFrame>;
}

export function StudentLayout({ children }) {
  return <LayoutFrame roleLabel={roleLabels.SINH_VIEN}>{children}</LayoutFrame>;
}

export function RoleLayout({ children }) {
  const { user } = useAuth();
  const layouts = {
    ADMIN: AdminLayout,
    GIANG_VIEN: InstructorLayout,
    SINH_VIEN: StudentLayout
  };
  const Layout = layouts[user?.role];

  return Layout ? (
    <Layout>{children}</Layout>
  ) : (
    <LayoutFrame roleLabel="LMS Mini">{children}</LayoutFrame>
  );
}
