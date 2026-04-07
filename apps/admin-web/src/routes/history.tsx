import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { useConversationHistory, useConversationSummary } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('open') || normalized.includes('active')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized.includes('ended') || normalized.includes('closed') || normalized.includes('resolved')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized.includes('transfer')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function HistoryPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const historyQuery = useConversationHistory();
  const selectedSummary = useConversationSummary(selectedId);

  const items = historyQuery.data ?? [];

  useEffect(() => {
    if (selectedId === null && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const leftTime = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
      const rightTime = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [items]);

  if (historyQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="h-80 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-80 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">历史失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 conversation history</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {historyQuery.error instanceof ApiError ? historyQuery.error.detail : '请求会话历史失败'}
        </p>
      </section>
    );
  }

  const selectedHistory = sortedItems.find((item) => item.id === selectedId) ?? sortedItems[0] ?? null;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">History</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">会话历史</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接调用 `GET /conversation/conversations/history`，选择一条会话后再拉取对应 `summary`。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            历史数：{sortedItems.length}
            <div className="mt-1 text-xs text-slate-500">
              当前选中：{selectedHistory ? `#${selectedHistory.id}` : '无'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr_0.9fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">会话列表</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">history</span>
          </div>

          <div className="mt-4 space-y-3">
            {sortedItems.length > 0 ? (
              sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    item.id === selectedId
                      ? 'border-sky-200 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">会话 #{item.id}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        客户 {item.customer_profile_id} · {item.channel ?? '未知渠道'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneForStatus(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary ?? '暂无摘要'}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    最近消息 {formatDateTime(item.last_message_at)} · 创建 {formatDateTime(item.created_at)}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                暂无历史会话。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">会话摘要</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">summary</span>
          </div>

          {!selectedHistory ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              请选择一条会话查看摘要。
            </div>
          ) : selectedSummary.isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100" />
            </div>
          ) : selectedSummary.isError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {selectedSummary.error instanceof ApiError
                ? selectedSummary.error.detail
                : '请求会话摘要失败'}
            </div>
          ) : selectedSummary.data ? (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">会话 ID</dt>
                  <dd className="mt-1 font-medium text-slate-900">#{selectedSummary.data.conversation_id}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">消息数</dt>
                  <dd className="mt-1 font-medium text-slate-900">{selectedSummary.data.message_count}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">满意度</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {selectedSummary.data.satisfaction_score ?? '暂无'}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">最后消息</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatDateTime(selectedSummary.data.last_message_at)}
                  </dd>
                </div>
              </dl>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">AI 摘要</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {selectedSummary.data.ai_summary ?? selectedHistory.summary ?? '暂无 AI 摘要'}
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                会话状态：{selectedHistory.status} · 负责人：{selectedHistory.assignee ?? '未分配'} · 渠道：
                {selectedHistory.channel ?? '未知'}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              暂无摘要数据。
            </div>
          )}
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">会话画像</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">profile</span>
            </div>

            <dl className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">问题摘要</dt>
                <dd className="mt-2 text-sm font-medium leading-6 text-slate-900">
                  用户询问退款到账时效
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">AI 摘要</dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {selectedSummary.data?.ai_summary ?? selectedHistory.summary ?? '暂无 AI 摘要'}
                </dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">消息数</dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedSummary.data?.message_count ?? selectedHistory.summary?.length ?? 0}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">满意度</dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedSummary.data?.satisfaction_score ?? '暂无'}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">建议动作</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">next step</span>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-medium text-sky-900">当前建议</p>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                建议先补充处理步骤，并将客户问题转为工单，便于后续回访与 SLA 跟踪。
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/tickets"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                转工单处理
              </Link>
              <Link
                to="/service-ops"
                className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
              >
                返回运营台
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
