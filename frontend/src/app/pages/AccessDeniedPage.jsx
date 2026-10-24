import { Link } from 'react-router-dom';

export function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-semibold">Không có quyền truy cập</h1>
      <Link className="text-primary underline" to="/">
        Về trang phù hợp với quyền của bạn
      </Link>
    </main>
  );
}
