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

    await page.getByRole('button', { name: '满意度', exact: true }).click();
    await expect(page.getByRole('heading', { name: '满意度提交' })).toBeVisible();
    await page.getByLabel('comment').fill(comment);
    await page.getByRole('button', { name: '提交满意度' }).click();

    await expect(page.getByText(/已提交/)).toBeVisible();
  });

  test('routes refund and account freeze questions through langgraph triage and shows ai guidance', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const message = `账号冻结了，退款也还没到账，订单号 TK${uniqueSuffix}，手机号 13812345678，请尽快处理`;

    await page.goto(`${customerH5Url}/standalone`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '创建并连接会话' }).click();
    await expect(page.getByText(/会话 #\d+/)).toBeVisible();

    const composer = page.locator('#customer-message');
    await composer.fill(message);
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText('AI 建议')).toBeVisible();
    await expect(page.getByText(/流程 langgraph/)).toBeVisible();
    await expect(
      page
        .locator('div')
        .filter({ hasText: 'AI 建议' })
        .filter({ hasText: /建议转人工继续处理当前问题。|AI 需要更多信息|已准备好转人工/ })
        .first(),
    ).toBeVisible();
  });

  test('starts a voice session, appends a partial transcript, and finalizes an AI-assisted turn', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const transcript = `我想咨询 iPhone 16 Pro 的保修和维修门店，订单号 TK${uniqueSuffix}`;

    await page.goto(`${customerH5Url}/standalone`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '创建并连接会话' }).click();
    await expect(page.getByText(/会话 #\d+/)).toBeVisible();

    await page.getByRole('button', { name: '开始语音会话' }).click();
    await expect(page.getByText(/会话 \d+/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: '实时转写草稿' })).toBeEnabled();

    const voiceDraft = page.getByRole('textbox', { name: '实时转写草稿' });
    await voiceDraft.fill(transcript);

    await page.getByRole('button', { name: '追加转写' }).click();
    await expect(page.getByText(transcript)).toBeVisible();

    await page.getByRole('button', { name: '完成本轮' }).click();
    const aiResultCard = page.getByTestId('voice-last-turn');
    await expect(aiResultCard).toBeVisible();
    await expect(aiResultCard.getByText(/最新 AI 结果/)).toBeVisible();
    await expect(aiResultCard.getByText(/Apple|iPhone|门店|保修|维修|建议/)).toBeVisible();
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
