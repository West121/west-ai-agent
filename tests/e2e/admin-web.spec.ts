import { expect, test, type Page } from '@playwright/test';

import { loginToAdmin, mockVideoBrowserApis, openAdminNav } from './helpers';

function sectionByHeading(page: Page, heading: string) {
  return page.getByRole('heading', { name: heading, exact: true }).locator('xpath=ancestor::section[1]');
}

test.describe('admin-web critical flows', () => {
  test('renders analytics overview and links to report center', async ({ page }) => {
    await loginToAdmin(page);
    await openAdminNav(page, '分析', '会话分析');

    await expect(page.getByRole('heading', { name: '会话分析' })).toBeVisible();
    await expect(page.getByText('摘要覆盖率')).toBeVisible();
    await expect(page.getByText('满意度覆盖率')).toBeVisible();
    await expect(page.getByText('近 7 天会话趋势')).toBeVisible();
    await expect(page.getByText('工单优先级分布')).toBeVisible();

    await page.getByRole('main').getByRole('link', { name: '报表中心' }).click();
    await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible();
  });

  test('renders report center metrics and opens video service', async ({ page }) => {
    await loginToAdmin(page);
    await openAdminNav(page, '报表中心', '报表中心');

    await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible();
    await expect(page.getByText('客户总量')).toBeVisible();
    await expect(page.getByText('开放会话')).toBeVisible();
    await expect(page.getByText('视频会话摘要覆盖')).toBeVisible();
    await expect(page.getByText('工单状态分布')).toBeVisible();

    await page.getByRole('link', { name: '查看视频客服' }).click();
    await expect(page.getByRole('heading', { name: '视频客服' })).toBeVisible();
  });

  test('creates and updates a ticket from service ops', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const ticketTitle = `E2E 工单 ${uniqueSuffix}`;
    const ticketSummary = `来自 Playwright 的工单摘要 ${uniqueSuffix}`;
    const updatedStatus = `resolved-e2e-${uniqueSuffix}`;
    const updatedSummary = `工单已由 Playwright 更新 ${uniqueSuffix}`;

    await loginToAdmin(page);
    await openAdminNav(page, '服务运营', '服务运营台');

    const createTicketForm = page.locator('form').filter({ hasText: '新建工单' });
    await createTicketForm.getByLabel('标题').fill(ticketTitle);
    await createTicketForm.getByLabel('状态').fill('open');
    await createTicketForm.getByLabel('优先级').fill('normal');
    await createTicketForm.getByLabel('来源').fill('web');
    await createTicketForm.getByLabel('负责人').fill('agent-e2e');
    await createTicketForm.getByLabel('负责组').fill('测试组');
    await createTicketForm.getByLabel('摘要').fill(ticketSummary);
    await createTicketForm.getByRole('button', { name: '创建工单' }).click();

    await expect(page.getByText(/已创建工单 #\d+/)).toBeVisible();
    const ticketListSection = sectionByHeading(page, '工单列表');
    await expect(ticketListSection.getByText(ticketTitle)).toBeVisible();

    await ticketListSection.getByRole('button', { name: new RegExp(ticketTitle) }).click();

    const updateTicketForm = page.locator('form').filter({ hasText: '更新选中工单' });
    await updateTicketForm.getByLabel('状态').fill(updatedStatus);
    await updateTicketForm.getByLabel('摘要').fill(updatedSummary);
    await updateTicketForm.getByRole('button', { name: '更新工单' }).click();

    await expect(ticketListSection.getByText(updatedStatus)).toBeVisible();
  });

  test('creates, submits review, and publishes a knowledge document', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const title = `E2E 知识文档 ${uniqueSuffix}`;
    const content = `这是一条由 Playwright 创建的知识正文 ${uniqueSuffix}`;

    await loginToAdmin(page);
    await openAdminNav(page, '知识工坊', '知识工坊');

    const createDocumentForm = page.locator('form').filter({ hasText: '导入知识文档' });
    await createDocumentForm.getByLabel('Tenant ID').fill('tenant-e2e');
    await createDocumentForm.getByLabel('类型').fill('faq');
    await createDocumentForm.getByLabel('语言').fill('zh-CN');
    await createDocumentForm.getByLabel('标题').fill(title);
    await createDocumentForm.getByLabel('分类').fill('测试');
    await createDocumentForm.getByLabel('标签').fill('e2e,playwright');
    await createDocumentForm.getByLabel('渠道').fill('web,h5');
    await createDocumentForm.getByLabel('正文').fill(content);
    await createDocumentForm.getByRole('button', { name: '导入文档' }).click();

    await expect(page.getByText(/已导入文档 #\d+/).first()).toBeVisible();
    const documentListSection = sectionByHeading(page, '文档列表');
    await documentListSection.getByRole('button', { name: new RegExp(title) }).click();

    const detailSection = sectionByHeading(page, '文档详情与审核');
    await expect(detailSection.getByText(title)).toBeVisible();

    await detailSection.getByRole('button', { name: '提交审核' }).click();
    await expect(detailSection.getByText('in_review')).toBeVisible();

    const publishForm = detailSection.locator('form').filter({ hasText: '发布版本' });
    await publishForm.locator('input[name="publish_version"]').fill('2');
    await publishForm.getByRole('button', { name: '发布' }).click();

    await expect(detailSection.getByText('published')).toBeVisible();
    await expect(detailSection.getByText('发布版 2')).toBeVisible();
  });

  test('creates a voice session, appends transcript, and creates a handoff record from conversations workspace', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now();

    await loginToAdmin(page);
    await page.goto('/conversations', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '会话工作台' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '语音会话面板' })).toBeVisible();
    const voicePanel = sectionByHeading(page, '语音会话面板');

    await page.getByRole('button', { name: '开启语音会话' }).click();
    await expect(voicePanel.getByRole('heading', { name: '语音会话详情' })).toBeVisible();
    await expect(voicePanel.getByText(/voice-room-\d+/).first()).toBeVisible();
    await expect(voicePanel.getByText('当前会话缺少客户或会话 id，无法创建语音会话')).toHaveCount(0);

    await page.getByLabel('转写内容').fill(`用户咨询 iPhone 16 Pro 售后服务 ${uniqueSuffix}`);
    await page.getByRole('button', { name: '保存转写' }).click();
    await expect(page.getByText('已写入转写片段')).toBeVisible();

    await page.getByLabel('接管原因').fill('语音识别需要人工确认售后网点');
    await page.getByLabel('接管摘要').fill(`用户咨询授权维修网点，需人工回访 ${uniqueSuffix}`);
    await page.getByRole('button', { name: '创建接管' }).click();
    await expect(page.getByText('已创建转人工记录')).toBeVisible();
  });

  test('runs the video service flow with browser media stubs', async ({ page }) => {
    const uniqueSuffix = Date.now();
    await mockVideoBrowserApis(page);

    await loginToAdmin(page);
    await openAdminNav(page, '视频客服', '视频客服');

    const startButton = page.getByRole('button', { name: '开始视频服务' });
    if (await startButton.isVisible()) {
      await startButton.click();
      await expect(page.getByText(/已开始视频会话 #\d+/)).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: '结束服务' })).toBeVisible();
    }

    await page.getByRole('button', { name: '发起 1v1 通话' }).click();
    await page.waitForTimeout(750);
    await page.getByRole('button', { name: '开始录制' }).click();
    await expect(page.getByRole('button', { name: '停止录制' })).toBeEnabled({ timeout: 10000 });
    await page.getByRole('button', { name: '停止录制' }).click();

    await expect(page.getByText(/录制已上传，时长 \d+ 秒/)).toBeVisible();
    await expect(page.getByRole('button', { name: /浏览器录制/ }).first()).toBeVisible();

    await page.getByRole('button', { name: '抓拍记录' }).click();
    await expect(page.getByText(/已创建抓拍记录「抓拍 \d+」/)).toBeVisible();

    await page.getByRole('button', { name: '转工单' }).click();
    await expect(page.getByText(/已转工单 #\d+/)).toBeVisible();

    const summarySection = page.getByRole('heading', { name: '会后摘要与抓拍' }).locator('xpath=ancestor::section[1]');
    await summarySection.getByLabel('人工摘要').fill(`人工摘要 ${uniqueSuffix}`);
    await summarySection.getByPlaceholder('问题分类').fill('退款');
    await summarySection.getByPlaceholder('下一步动作').fill('24 小时内回访');
    await summarySection.getByPlaceholder('处理结果').fill('等待财务回访');
    await summarySection.getByPlaceholder('转人工/转工单原因').fill('财务确认到账');
    await summarySection.getByLabel('需要后续跟进').check();
    await summarySection.getByRole('button', { name: '保存会后摘要' }).click();

    await expect(page.getByText('会后摘要已保存')).toBeVisible();
    await expect(page.getByText('录制回放')).toBeVisible();
    await expect(page.getByText('会话概览')).toBeVisible();
  });
});
