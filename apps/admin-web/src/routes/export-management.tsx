import { Link } from '@tanstack/react-router';

import { useConversationHistory, useKnowledgeDocuments, useLeaveMessages, useTickets } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function ExportCard({
  title,
  count,
  hint,
}: {
  title: string;
  count: string;
  hint: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{count}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

export function ExportManagementPage() {
  const ticketsQuery = useTickets();
  const leaveMessagesQuery = useLeaveMessages();
  const historyQuery = useConversationHistory();
  const knowledgeQuery = useKnowledgeDocuments();

  const tickets = ticketsQuery.data ?? [];
  const leaveMessages = leaveMessagesQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const knowledge = knowledgeQuery.data ?? [];

  if (ticketsQuery.isLoading || leaveMessagesQuery.isLoading || historyQuery.isLoading || knowledgeQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (ticketsQuery.isError || leaveMessagesQuery.isError || historyQuery.isError || knowledgeQuery.isError) {
    const detail =
      ticketsQuery.error instanceof ApiError
        ? ticketsQuery.error.detail
        : leaveMessagesQuery.error instanceof ApiError
          ? leaveMessagesQuery.error.detail
          : historyQuery.error instanceof ApiError
            ? historyQuery.error.detail
            : knowledgeQuery.error instanceof ApiError
              ? knowledgeQuery.error.detail
              : '请求导出管理数据失败';

    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">导出失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成导出管理页面</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{detail}</p>
      </section>
    );
  }

  const knowledgeExports = knowledge.filter((item) => item.status.toLowerCase().includes('published')).slice(0, 3);
  const conversationExports = history.slice(0, 3);
  const exportTasks = [
    {
      name: '工单与留言日报',
      source: 'service',
      status: 'ready',
      updatedAt: tickets[0]?.updated_at ?? leaveMessages[0]?.updated_at ?? null,
    },
    {
      name: '历史会话归档',
      source: 'conversation',
      status: 'ready',
      updatedAt: history[0]?.last_message_at ?? null,
    },
    {
      name: '知识发布快照',
      source: 'knowledge',
      status: knowledgeExports.length > 0 ? 'ready' : 'pending',
      updatedAt: knowledgeExports[0]?.updated_at ?? null,
    },
  ];

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Export Management</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">导出管理</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              汇总工单、留言、会话与知识的导出任务，给运营同学一个可执行的导出工作台。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/report-center" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              前往报表中心
            </Link>
            <button type="button" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              创建导出任务
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ExportCard title="工单导出" count={String(tickets.length)} hint="service/tickets 可导出记录数" />
          <ExportCard title="留言导出" count={String(leaveMessages.length)} hint="service/leave-messages 可导出记录数" />
          <ExportCard title="历史会话" count={String(history.length)} hint="conversation history 可导出记录数" />
          <ExportCard title="知识快照" count={String(knowledgeExports.length)} hint="已发布知识文档可导出数" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">导出任务模板</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">templates</span>
          </div>
          <div className="mt-4 space-y-3">
            {exportTasks.map((task) => (
              <article key={task.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{task.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{task.source}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {task.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500">
                    立即导出
                  </button>
                  <button type="button" className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50">
                    查看配置
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  最近数据更新时间：{task.updatedAt ? formatDateTime(task.updatedAt) : '暂无'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">知识快照</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">knowledge</span>
            </div>
            <div className="mt-4 space-y-3">
              {knowledgeExports.length > 0 ? (
                knowledgeExports.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.category} · v{item.publish_version ?? item.version}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无可导出的已发布知识。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">最近会话归档</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">history</span>
            </div>
            <div className="mt-4 space-y-3">
              {conversationExports.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">会话 #{item.id}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.channel ?? '未知渠道'} · {item.status}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
