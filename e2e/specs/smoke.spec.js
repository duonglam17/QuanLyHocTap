import { expect, test as playwrightTest } from '@playwright/test';
import { accounts, loginAs, test } from '../fixtures/auth.js';

const homeByRole = {
  ADMIN: { path: '/admin/users', heading: 'Quản lý người dùng' },
  GIANG_VIEN: { path: '/courses', heading: 'Danh sách khóa học' },
  SINH_VIEN: { path: '/courses', heading: 'Danh sách khóa học' }
};

for (const [role, account] of Object.entries(accounts)) {
  playwrightTest(`smoke: ${role} can sign in through /login and reach its home`, async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập LMS Mini' })).toBeVisible();
    await page.getByLabel('Tên đăng nhập hoặc email').fill(account.username);
    await page.getByLabel('Mật khẩu').fill(account.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(new RegExp(`${homeByRole[role].path.replaceAll('/', '\\/')}$`));
    await expect(page.getByRole('heading', { name: homeByRole[role].heading })).toBeVisible();
  });
}

test('loginAs stores reusable storage state for each seeded role', async ({ loginAs: authenticate }) => {
  for (const role of Object.keys(accounts)) {
    const session = await authenticate(role);
    expect(session.user.role).toBe(role);
    expect(session.storageStatePath).toContain(`${role.toLowerCase()}.json`);
  }
});
