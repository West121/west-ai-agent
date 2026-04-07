import { expect, type Page } from '@playwright/test';

export const adminWebUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:43173';
export const customerH5Url = process.env.CUSTOMER_H5_URL ?? 'http://127.0.0.1:43174';

export async function loginToAdmin(page: Page) {
  await page.goto(`${adminWebUrl}/auth`, { waitUntil: 'networkidle' });
  await page.locator('input[placeholder="admin"]').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.getByRole('button', { name: '登录' }).click(),
  ]);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('企业管理后台')).toBeVisible();
  await expect(page.getByText(/admin · \d+ 权限/)).toBeVisible();
}

export async function openAdminNav(page: Page, label: string, heading: string) {
  await page.getByRole('link', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}
