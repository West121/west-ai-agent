import { useMemo, useState } from 'react';

import { useLeaveMessages } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('new') || normalized.includes('pending')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized.includes('progress') || normalized.includes('assigned')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized.includes('done') || normalized.includes('closed') || normalized.includes('resolved')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function LeaveMessagesPage() {
  const [keyword, setKeyword] = useState('');
  const query = useLeaveMessages();

  const filteredMessages = useMemo(() => {
    const items = query.data ?? [];
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return items;
    }
    return items.filter((message) => {
      const haystack = [
        message.visitor_name,
        message.phone ?? '',
        message.email ?? '',
        message.source,
        message.status,
        message.subject,
        message.content ?? '',
        message.assigned_group ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [keyword, query.data]);

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-[1.35rem] bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">留言失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 service leave-messages</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError ? query.error.detail : '请求留言列表失败'}
        </p>
      </section>
    );
  }

  const messages = filteredMessages;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Leave Messages</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">留言列表</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接调用 `GET /service/leave-messages`，按访客信息、主题、来源和分组进行检索。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            留言数：{(query.data ?? []).length}
            <div className="mt-1 text-xs text-slate-500">当前匹配：{messages.length}</div>
          </div>
        </div>

        <div className="mt-6">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索访客、电话、邮箱、来源、状态或主题"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      {messages.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">{message.visitor_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{message.subject}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(message.status)}`}>
                  {message.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {message.source}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {message.assigned_group ?? '未分组'}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">电话</dt>
                  <dd className="mt-1 font-medium text-slate-900">{message.phone ?? '暂无'}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">邮箱</dt>
                  <dd className="mt-1 font-medium text-slate-900">{message.email ?? '暂无'}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 md:col-span-2">
                  <dt className="text-slate-500">内容</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-700">{message.content ?? '暂无内容'}</dd>
                </div>
              </dl>

              <div className="mt-4 text-xs text-slate-500">
                创建于 {formatDateTime(message.created_at)} · 更新于 {formatDateTime(message.updated_at)}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
          暂无留言数据。
        </div>
      )}
    </section>
  );
}

