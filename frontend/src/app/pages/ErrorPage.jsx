import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Không thể tải trang.'
    : error instanceof Error
      ? error.message
      : 'Đã xảy ra lỗi không xác định.';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Không thể mở trang</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link className="inline-flex h-10 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" to="/">
        Về trang chính
      </Link>
    </main>
  );
}
