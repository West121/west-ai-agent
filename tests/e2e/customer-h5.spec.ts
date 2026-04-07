import { expect, test } from '@playwright/test';

import { customerH5Url } from './helpers';

test.describe('customer-h5 standalone flows', () => {
  test('creates a standalone conversation, sends a chat message, and submits satisfaction', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const message = `这是一条来自 Playwright E2E 的消息 ${uniqueSuffix}`;
    const comment = `满意度反馈 ${uniqueSuffix}`;

    await page.goto(`${customerH5Url}/standalone`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '创建并连接会话' }).click();
    await expect(page.getByText(/会话 #\d+/)).toBeVisible();

    const conversationIdInput = page.getByLabel('conversation id');
    await expect(conversationIdInput).not.toHaveValue('');

    const composer = page.locator('#customer-message');
    await composer.fill(message);
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText('已连接到 conversation')).toBeVisible();

    await page.getByRole('button', { name: '满意度', exact: true }).click();
    await expect(page.getByRole('heading', { name: '满意度提交' })).toBeVisible();
    await page.getByLabel('comment').fill(comment);
    await page.getByRole('button', { name: '提交满意度' }).click();

    await expect(page.getByText(/已提交/)).toBeVisible();
  });

  test('submits a leave message from standalone leave-message page', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const subject = `Playwright 留言主题 ${uniqueSuffix}`;
    const content = `这是一条来自 Playwright 的留言 ${uniqueSuffix}`;

    await page.goto(`${customerH5Url}/leave-message`, { waitUntil: 'networkidle' });
    await page.getByLabel('visitor_name').fill(`访客 ${uniqueSuffix}`);
    await page.getByLabel('subject').fill(subject);
    await page.getByLabel('content').fill(content);
    await page.getByRole('button', { name: '提交留言' }).click();

    await expect(page.getByText(/留言已提交/)).toBeVisible();
  });
});
