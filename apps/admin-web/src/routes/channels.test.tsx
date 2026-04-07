import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';

import { ChannelsPage } from '@/routes/channels';
import { renderWithProviders } from '@/test/render';

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('ChannelsPage', () => {
  it('generates an H5 link and validates copy/open interactions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const { pathname } = new URL(url, 'http://localhost:8000');

      if (method === 'GET' && pathname === '/channels/apps') {
        return jsonResponse({
          items: [
            {
              id: 7,
              name: '官网 H5',
              code: 'official_h5',
              base_url: 'https://agent.example.com',
              is_active: true,
            },
          ],
        });
      }

      if (method === 'POST' && pathname === '/channels/apps/7/h5-link') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { path: string };
        expect(body).toEqual({ path: '/promo/welcome' });
        return jsonResponse({
          channel_app_id: 7,
          path: body.path,
          h5_url: 'https://agent.example.com/promo/welcome',
        });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });
    vi.stubGlobal('open', open);

    renderWithProviders(<ChannelsPage />);

    expect(await screen.findByText('渠道管理')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('嵌入路径'));
    await userEvent.type(screen.getByLabelText('嵌入路径'), '/promo/welcome');
    await userEvent.click(screen.getByRole('button', { name: '生成 H5 链接' }));

    expect(await screen.findByText('https://agent.example.com/promo/welcome')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '复制链接' }));
    expect(writeText).toHaveBeenCalledWith('https://agent.example.com/promo/welcome');
    expect(screen.getByText('链接已复制到剪贴板。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '打开验证' }));
    expect(open).toHaveBeenCalledWith('https://agent.example.com/promo/welcome', '_blank', 'noopener,noreferrer');
    expect(screen.getByText('已打开新窗口进行验证。')).toBeInTheDocument();
  });
});
