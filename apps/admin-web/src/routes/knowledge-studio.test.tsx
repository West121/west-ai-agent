import type { AnchorHTMLAttributes } from 'react';

import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import type { KnowledgeDocument } from '@/lib/platform-api';
import { KnowledgeStudioPage } from '@/routes/knowledge-studio';
import { renderWithProviders } from '@/test/render';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('KnowledgeStudioPage', () => {
  it('imports a document, rebuilds index, publishes a version, and shows worker results', async () => {
    let documents: KnowledgeDocument[] = [
      {
        id: 1,
        tenant_id: 'tenant-1',
        type: 'faq',
        title: '退款说明',
        source_kind: 'manual',
        status: 'draft',
        category: '售后',
        tags: ['退款'],
        language: 'zh-CN',
        channels: ['web'],
        version: 1,
        publish_version: null,
        content: '原始内容',
        index_status: 'idle',
        indexed_chunk_count: 0,
        last_indexed_at: null,
        last_index_task_id: null,
        last_index_error: null,
        last_index_result: null,
        imported_at: null,
        published_at: null,
        created_at: '2026-04-06T08:00:00.000Z',
        updated_at: '2026-04-06T08:00:00.000Z',
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const { pathname } = new URL(url, 'http://localhost:8000');

      if (method === 'GET' && pathname === '/knowledge/documents') {
        return jsonResponse(documents);
      }

      if (method === 'GET' && pathname.startsWith('/knowledge/documents/')) {
        const documentId = Number(pathname.split('/').pop());
        return jsonResponse(documents.find((item) => item.id === documentId));
      }

      if (method === 'POST' && pathname === '/knowledge/documents/import') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body.tags).toEqual(['退款', '常见问题']);
        expect(body.channels).toEqual(['web', 'h5']);
        const created = {
          id: 2,
          tenant_id: String(body.tenant_id),
          type: String(body.type),
          title: String(body.title),
          source_kind: 'imported',
          status: 'draft',
          category: String(body.category),
          tags: body.tags as string[],
          language: String(body.language),
          channels: body.channels as string[],
          version: 1,
          publish_version: null,
          content: String(body.content),
          index_status: 'idle',
          indexed_chunk_count: 0,
          last_indexed_at: null,
          last_index_task_id: null,
          last_index_error: null,
          last_index_result: null,
          imported_at: '2026-04-06T09:00:00.000Z',
          published_at: null,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-06T09:00:00.000Z',
        };
        documents = [...documents, created];
        return jsonResponse(created, { status: 201 });
      }

      if (method === 'POST' && pathname === '/knowledge/documents/2/submit-review') {
        documents = documents.map((item) =>
          item.id === 2 ? { ...item, status: 'in_review', updated_at: '2026-04-06T09:05:00.000Z' } : item,
        );
        return jsonResponse(documents.find((item) => item.id === 2));
      }

      if (method === 'POST' && pathname === '/knowledge/documents/2/publish-version') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { publish_version: number };
        documents = documents.map((item) =>
          item.id === 2
            ? {
                ...item,
                status: 'published',
                publish_version: body.publish_version,
                published_at: '2026-04-06T09:06:00.000Z',
                updated_at: '2026-04-06T09:06:00.000Z',
              }
            : item,
        );
        return jsonResponse(documents.find((item) => item.id === 2));
      }

      if (method === 'POST' && pathname === '/knowledge/documents/2/rebuild-index') {
        documents = documents.map((item) =>
          item.id === 2
            ? {
                ...item,
                index_status: 'completed',
                indexed_chunk_count: 2,
                last_indexed_at: '2026-04-06T09:07:00.000Z',
                last_index_task_id: 'knowledge-2-v1',
                last_index_result: {
                  search_index: {
                    provider: 'in_memory',
                    indexed_count: 2,
                  },
                },
              }
            : item,
        );
        return jsonResponse({
          document_id: 2,
          task_id: 'knowledge-2-v1',
          status: 'completed',
          indexed_chunk_count: 2,
          indexed_at: '2026-04-06T09:07:00.000Z',
          result: {
            search_index: {
              provider: 'in_memory',
              indexed_count: 2,
            },
          },
        });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<KnowledgeStudioPage />);

    expect(await screen.findByText('知识工坊')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Tenant ID'), 'tenant-2');
    await userEvent.type(screen.getByLabelText('类型'), 'faq');
    await userEvent.type(screen.getByLabelText('标题'), '新退款政策');
    await userEvent.type(screen.getByLabelText('分类'), '售后');
    await userEvent.type(screen.getByLabelText('标签'), '退款,常见问题');
    await userEvent.clear(screen.getByLabelText('渠道'));
    await userEvent.type(screen.getByLabelText('渠道'), 'web,h5');
    await userEvent.type(screen.getByLabelText('正文'), '支持七天无理由退款');
    await userEvent.click(screen.getByRole('button', { name: '导入文档' }));

    expect(screen.getAllByText('已导入文档 #2，详情面板会自动切换到新文档。').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /新退款政策/ }));

    await userEvent.click(screen.getByRole('button', { name: '重建索引' }));
    await waitFor(() => {
      expect(screen.getAllByText('completed').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('已完成索引重建，共写入 2 个切片。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 个切片').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: '提交审核' }));
    await waitFor(() => {
      expect(screen.getAllByText('in_review').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('文档已提交审核，等待发布。').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: '发布' }));
    await waitFor(() => {
      expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('已发布版本 v1，详情已同步刷新。').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/已发布于/).length).toBeGreaterThan(0);
  });
});
