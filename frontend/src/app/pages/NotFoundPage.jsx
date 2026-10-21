import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <Link className="text-primary underline" to="/login">
        Về trang bắt đầu
      </Link>
    </main>
  );
}
