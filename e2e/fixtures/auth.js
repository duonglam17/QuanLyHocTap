import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';

const accounts = {
  ADMIN: { username: 'admin', password: 'MatKhau@123' },
  GIANG_VIEN: { username: 'gv_mai', password: 'MatKhau@123' },
  SINH_VIEN: { username: 'sv_nam', password: 'MatKhau@123' }
};

const directory = path.dirname(fileURLToPath(import.meta.url));
const generatedAuthDirectory = path.resolve(directory, '../.generated/auth');

export async function loginAs(role, { baseURL, context } = {}) {
  const account = accounts[role];
  if (!account) {
    throw new TypeError(`Unsupported seeded E2E role "${role}".`);
  }
  const origin = baseURL || process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
  const response = await fetch(new URL('/api/auth/login', origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
  const session = await response.json();
  if (!response.ok) {
    throw new Error(
      `E2E login for ${role} failed (${response.status}): ${session.message || response.statusText}`
    );
  }
  if (!session.accessToken || !session.refreshToken || session.user?.role !== role) {
    throw new Error(`E2E login response for ${role} did not match the expected session contract.`);
  }

  const user = {
    id: session.user.id,
    username: session.user.username || account.username,
    fullName: session.user.fullName || session.user.full_name || '',
    role: session.user.role
  };
  const api = async (requestPath, { method = 'GET', body } = {}) => {
    const normalizedPath = requestPath.replace(/^\/+/, '');
    const apiURL = new URL(`/api/${normalizedPath}`, origin);
    const apiResponse = await fetch(apiURL, {
      method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const contentType = apiResponse.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await apiResponse.json()
      : await apiResponse.text();
    if (!apiResponse.ok) {
      throw new Error(
        `E2E API ${method} ${requestPath} failed (${apiResponse.status}): ${
          responseBody?.message || responseBody
        }`
      );
    }
    return responseBody;
  };
  const storageStatePath = path.join(generatedAuthDirectory, `${role.toLowerCase()}.json`);
  await mkdir(generatedAuthDirectory, { recursive: true });
  await writeFile(
    storageStatePath,
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin: new URL(origin).origin,
            localStorage: [
              { name: 'lms.accessToken', value: session.accessToken },
              { name: 'lms.refreshToken', value: session.refreshToken },
              { name: 'lms.user', value: JSON.stringify(user) }
            ]
          }
        ]
      },
      null,
      2
    )
  );

  if (context) {
    await context.addInitScript(
      ({ expectedOrigin, storageItems }) => {
        if (window.location.origin !== expectedOrigin) return;
        for (const [key, value] of Object.entries(storageItems)) {
          window.localStorage.setItem(key, value);
        }
      },
      {
        expectedOrigin: new URL(origin).origin,
        storageItems: {
          'lms.accessToken': session.accessToken,
          'lms.refreshToken': session.refreshToken,
          'lms.user': JSON.stringify(user)
        }
      }
    );
  }

  return { ...session, user, storageStatePath, api };
}

export const test = base.extend({
  loginAs: async ({ context }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    await use((role) => loginAs(role, { baseURL, context }));
  }
});

export { accounts };
