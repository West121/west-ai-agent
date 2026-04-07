import { expect, test, type Page } from '@playwright/test';

import { loginToAdmin, openAdminNav } from './helpers';

function sectionByHeading(page: Page, heading: string) {
  return page.getByRole('heading', { name: heading, exact: true }).locator('xpath=ancestor::section[1]');
}

test.describe('admin-web critical flows', () => {
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
});
