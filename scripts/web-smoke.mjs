import { chromium } from 'playwright';

const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:4173';
const h5Url = process.env.CUSTOMER_H5_URL ?? 'http://127.0.0.1:4174';
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

async function runAdminSmoke(browser) {
  const page = await browser.newPage();
  await page.goto(`${adminUrl}/auth`, { waitUntil: 'networkidle' });

  await page.locator('input[placeholder="admin"]').fill(adminUsername);
  await page.locator('input[type="password"]').fill(adminPassword);

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.getByRole('button', { name: '登录' }).click(),
  ]);

  await page.waitForLoadState('networkidle');
  await page.getByText('企业管理后台').waitFor();
  await page.getByText(/admin · \d+ 权限/).waitFor();

  await page.getByRole('link', { name: '服务运营' }).click();
  await page.getByRole('heading', { name: '服务运营台' }).waitFor();

  await page.close();
}

async function runCustomerH5Smoke(browser) {
  const page = await browser.newPage();
  await page.goto(`${h5Url}/standalone`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: '创建并连接会话' }).click();
  await page.getByText(/会话 #\d+/).waitFor();

  const messageBox = page.locator('textarea').last();
  await messageBox.fill('这是一条来自 smoke test 的消息');
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.getByText('这是一条来自 smoke test 的消息').waitFor();

  await page.getByRole('link', { name: '留言', exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith('/leave-message'));
  await page.locator('textarea').fill('这是一条来自 smoke test 的留言');
  await page.getByRole('button', { name: '提交留言' }).click();
  await page.getByText(/留言已提交/).waitFor();

  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    await runAdminSmoke(browser);
    await runCustomerH5Smoke(browser);
    console.log('WEB_SMOKE_OK');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
