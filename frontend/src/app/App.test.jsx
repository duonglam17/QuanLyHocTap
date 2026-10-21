import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { RoleGuard } from './auth/RoleGuard.jsx';
import { LoginPlaceholderPage } from './pages/LoginPlaceholderPage.jsx';

describe('route guard scaffold', () => {
  it('redirects unauthenticated users to the login placeholder', async () => {
    render(
      <MemoryRouter
        initialEntries={['/m1']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AuthProvider>
          <Routes>
            <Route
              path="/m1"
              element={
                <RoleGuard roles={['ADMIN']}>
                  <div>Protected placeholder</div>
                </RoleGuard>
              }
            />
            <Route path="/login" element={<LoginPlaceholderPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(
      await screen.findByText(
        'Khung trang đăng nhập. Xác thực sẽ được tích hợp ở bước triển khai module.'
      )
    ).toBeInTheDocument();
  });
});
