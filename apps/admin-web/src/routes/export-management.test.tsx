import type { AnchorHTMLAttributes } from 'react';

import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/react';

import { ExportManagementPage } from '@/routes/export-management';
import { renderWithProviders } from '@/test/render';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('ExportManagementPage', () => {
  it('creates, executes, completes, and loads export task details', async () => {
    const tasks: Array<{
      id: number;
      name: string;
      source_kind: string;
      format: string;
      status: string;
      row_count: number | null;
      download_url: string | null;
      last_error: string | null;
      started_at: string | null;
      completed_at: string | null;
      created_at: string;
      updated_at: string;
    }> = [
      {
        id: 1,
        name: '工单日报',
        source_kind: 'tickets',
        format: 'csv',
        status: 'completed',
        row_count: 2,
        download_url: 'http://localhost:8000/exporting/tasks/1/download',
        last_error: null,
        started_at: '2026-04-07T02:00:00.000Z',
        completed_at: '2026-04-07T02:05:00.000Z',
        created_at: '2026-04-07T02:00:00.000Z',
        updated_at: '2026-04-07T02:05:00.000Z',
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const { pathname } = new URL(url, 'http://localhost:8000');

      if (method === 'GET' && pathname === '/exporting/tasks') {
        return jsonResponse(tasks);
      }

      if (method === 'GET' && /^\/exporting\/tasks\/\d+$/.test(pathname)) {
        const taskId = Number(pathname.split('/').pop());
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error(`Unknown task ${taskId}`);
        return jsonResponse(task);
      }

      if (method === 'POST' && pathname === '/exporting/tasks') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { name: string; source_kind: string; format: string };
        const task = {
          id: tasks.length + 1,
          name: body.name,
          source_kind: body.source_kind,
          format: body.format,
          status: 'pending',
          row_count: null,
          download_url: null,
          last_error: null,
          started_at: null,
          completed_at: null,
          created_at: '2026-04-07T04:00:00.000Z',
          updated_at: '2026-04-07T04:00:00.000Z',
        };
        tasks.unshift(task);
        return jsonResponse(task, { status: 201 });
      }

      if (method === 'POST' && /^\/exporting\/tasks\/\d+\/execute$/.test(pathname)) {
        const taskId = Number(pathname.split('/')[3]);
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error(`Unknown task ${taskId}`);
        task.status = 'running';
        task.row_count = task.source_kind === 'tickets' ? 2 : 1;
        task.started_at = '2026-04-07T04:10:00.000Z';
        task.updated_at = task.started_at;
        return jsonResponse(task);
      }

      if (method === 'POST' && /^\/exporting\/tasks\/\d+\/complete$/.test(pathname)) {
        const taskId = Number(pathname.split('/')[3]);
        const task = tasks.find((item) => item.id === taskId);
        if (!task) throw new Error(`Unknown task ${taskId}`);
        task.status = 'completed';
        task.download_url = `http://localhost:8000/exporting/tasks/${taskId}/download`;
        task.completed_at = '2026-04-07T04:20:00.000Z';
        task.updated_at = task.completed_at;
        return jsonResponse(task);
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<ExportManagementPage />);

    expect(await screen.findByRole('heading', { name: '导出管理' })).toBeInTheDocument();
    expect(screen.getByText('任务总数')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建导出任务' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '留言日报' } });
    await userEvent.selectOptions(screen.getByLabelText('导出来源'), 'leave_messages');
    await userEvent.selectOptions(screen.getByLabelText('导出格式'), 'json');
    await userEvent.click(screen.getByRole('button', { name: '创建导出任务' }));

    expect(await screen.findByText('已创建导出任务：留言日报')).toBeInTheDocument();
    expect(screen.getAllByText('留言日报').length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
    expect(await screen.findByText('详情')).toBeInTheDocument();
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: '触发执行' })[0]);
    await waitFor(() => {
      expect(screen.getAllByText('running').length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByRole('button', { name: '标记完成' })[0]);
    await waitFor(() => {
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
      expect(screen.getByText('http://localhost:8000/exporting/tasks/1/download')).toBeInTheDocument();
    });
  });
});
