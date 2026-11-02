import { APP_NAME, LOGO_FULL_PATH } from '../../shared/lib/index.js';

export function LoginPlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <img
        alt={APP_NAME}
        className="h-24 w-auto object-contain"
        src={LOGO_FULL_PATH}
      />
      <div>
        <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
        <p className="mt-1 text-muted-foreground">
          Khung trang đăng nhập. Xác thực sẽ được tích hợp ở bước triển khai module.
        </p>
      </div>
    </main>
  );
}
