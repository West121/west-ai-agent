import { useMemo, useState } from 'react';

import { useKnowledgeDocuments } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

type ViewMode = 'table' | 'card';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('published') || normalized.includes('active')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (normalized.includes('draft') || normalized.includes('review')) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (normalized.includes('archived') || normalized.includes('disabled')) {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function categoryTone(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('faq') || normalized.includes('常见')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized.includes('流程')) {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }
  if (normalized.includes('文档') || normalized.includes('manual')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function KnowledgeCard({
  document,
}: {
  document: {
    id: number;
    type: string;
    title: string;
    status: string;
    category: string;
    tags: string[];
    language: string;
    channels: string[];
    version: number;
    publish_version: number | null;
    content: string | null;
    created_at: string;
    updated_at: string;
  };
}) {
  const preview = document.content?.trim().slice(0, 120);

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{document.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            #{document.id} · {document.type} · 版本 {document.version}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(document.status)}`}>
          {document.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${categoryTone(document.category)}`}>
          {document.category || '未分类'}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          {document.language}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          发布版 {document.publish_version ?? '暂无'}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3 md:col-span-2">
          <dt className="text-slate-500">正文摘要</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-700">
            {preview ? `${preview}${document.content && document.content.length > 120 ? '…' : ''}` : '暂无正文内容'}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">标签</dt>
          <dd className="mt-1 font-medium text-slate-900">{document.tags.length > 0 ? document.tags.join(' · ') : '无'}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">渠道</dt>
          <dd className="mt-1 font-medium text-slate-900">{document.channels.length > 0 ? document.channels.join(' · ') : '无'}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">创建时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDateTime(document.created_at)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">更新时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDateTime(document.updated_at)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function KnowledgePage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const query = useKnowledgeDocuments();

  const documents = query.data ?? [];

  const statusOptions = useMemo(
    () => [...new Set(documents.map((item) => item.status).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN')),
    [documents],
  );
  const categoryOptions = useMemo(
    () => [...new Set(documents.map((item) => item.category).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN')),
    [documents],
  );
  const typeOptions = useMemo(
    () => [...new Set(documents.map((item) => item.type).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN')),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || document.category === categoryFilter;
      const matchesType = typeFilter === 'all' || document.type === typeFilter;
      if (!matchesStatus || !matchesCategory || !matchesType) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const haystack = [
        document.title,
        document.type,
        document.status,
        document.category,
        document.language,
        document.tags.join(' '),
        document.channels.join(' '),
        document.content ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedKeyword);
    });
  }, [categoryFilter, documents, keyword, statusFilter, typeFilter]);

  const summaryCards = [
    { label: '文档总数', value: documents.length.toString(), hint: '直接来自 /knowledge/documents' },
    { label: '当前匹配', value: filteredDocuments.length.toString(), hint: '按状态、分类、类型和关键词筛选' },
    {
      label: '已发布',
      value: documents.filter((item) => item.status.toLowerCase().includes('published')).length.toString(),
      hint: '在线可见文档',
    },
    {
      label: '分类数',
      value: categoryOptions.length.toString(),
      hint: '当前返回的知识分类',
    },
  ];

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[1.35rem] bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">知识中心不可用</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 knowledge documents</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError ? query.error.detail : '请求知识列表失败'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Knowledge</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">知识文档</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接调用 `GET /knowledge/documents`，按状态、分类、类型和关键词浏览知识文档与发布情况。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            文档数：{documents.length}
            <div className="mt-1 text-xs text-slate-500">当前匹配：{filteredDocuments.length}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article key={card.label} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.hint}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="sr-only">搜索知识</span>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索标题、分类、标签、类型、渠道或正文"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">全部状态</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">全部分类</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">全部类型</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">视图</span>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'table'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800'
                }`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'card'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800'
                }`}
              >
                卡片
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-4">文档</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4">分类</th>
                <th className="px-5 py-4">标签 / 渠道</th>
                <th className="px-5 py-4">版本</th>
                <th className="px-5 py-4">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((document) => (
                  <tr key={document.id} className="text-sm">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-950">{document.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        类型 {document.type} · 语言 {document.language}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(document.status)}`}>
                        {document.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${categoryTone(document.category)}`}>
                        {document.category || '未分类'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{document.tags.length > 0 ? document.tags.join(' · ') : '无标签'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {document.channels.length > 0 ? document.channels.join(' · ') : '无渠道'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      v{document.version}
                      <div className="mt-1 text-xs text-slate-500">发布版 {document.publish_version ?? '暂无'}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDateTime(document.updated_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    没有匹配的知识文档
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((document) => <KnowledgeCard key={document.id} document={document} />)
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              没有匹配的知识文档
            </div>
          )}
        </div>
      )}
    </section>
  );
}
