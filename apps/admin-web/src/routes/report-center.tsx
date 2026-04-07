import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import {
  useAnalytics,
  useConversationHistory,
  useDashboardSummary,
  useKnowledgeDocuments,
  useLeaveMessages,
  useTickets,
} from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

export function ReportCenterPage() {
  const dashboardQuery = useDashboardSummary();
  const analyticsQuery = useAnalytics();
  const ticketsQuery = useTickets();
  const leaveMessagesQuery = useLeaveMessages();
  const knowledgeQuery = useKnowledgeDocuments();
  const historyQuery = useConversationHistory();

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const tickets = ticketsQuery.data ?? [];
  const leaveMessages = leaveMessagesQuery.data ?? [];
  const knowledge = knowledgeQuery.data ?? [];
  const history = historyQuery.data ?? [];

  const reportSummary = useMemo(() => {
    const openTickets = tickets.filter((ticket) => ticket.status.toLowerCase().includes('open')).length;
    const pendingLeaves = leaveMessages.filter((item) => item.status.toLowerCase().includes('pending')).length;
    const publishedKnowledge = knowledge.filter((item) => item.status.toLowerCase().includes('published')).length;
    const knowledgeRate = knowledge.length > 0 ? Math.round((publishedKnowledge / knowledge.length) * 100) : 0;
    const closedConversations = history.filter((item) => item.status.toLowerCase().includes('ended')).length;
    const avgSatisfaction = analytics?.averageSatisfaction !== null && analytics?.averageSatisfaction !== undefined
      ? analytics.averageSatisfaction.toFixed(1)
      : '暂无';

    return [
      { label: '开放工单', value: String(openTickets), hint: '来自 /service/tickets' },
      { label: '待处理留言', value: String(pendingLeaves), hint: '来自 /service/leave-messages' },
      { label: '知识发布率', value: `${knowledgeRate}%`, hint: '已发布 / 全量知识' },
      { label: '会话均分', value: avgSatisfaction, hint: '来自 conversation analytics' },
      { label: '已结束会话', value: String(closedConversations), hint: '来自 /conversation/conversations/history' },
      { label: '知识文档', value: String(knowledge.length), hint: '来自 /knowledge/documents' },
    ];
  }, [analytics?.averageSatisfaction, history, knowledge, leaveMessages, tickets]);

  if (dashboardQuery.isLoading || analyticsQuery.isLoading || ticketsQuery.isLoading || leaveMessagesQuery.isLoading || knowledgeQuery.isLoading || historyQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (dashboardQuery.isError || analyticsQuery.isError || ticketsQuery.isError || leaveMessagesQuery.isError || knowledgeQuery.isError || historyQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">报表失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成报表中心</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {dashboardQuery.error instanceof ApiError
            ? dashboardQuery.error.detail
            : analyticsQuery.error instanceof ApiError
              ? analyticsQuery.error.detail
              : ticketsQuery.error instanceof ApiError
                ? ticketsQuery.error.detail
                : leaveMessagesQuery.error instanceof ApiError
                  ? leaveMessagesQuery.error.detail
                  : knowledgeQuery.error instanceof ApiError
                    ? knowledgeQuery.error.detail
                    : historyQuery.error instanceof ApiError
                      ? historyQuery.error.detail
                      : '请求报表数据失败'}
        </p>
      </section>
    );
  }

  const topDocuments = dashboard?.topKnowledgeDocuments ?? knowledge.slice(0, 3);
  const topConversations = dashboard?.topConversations ?? history.slice(0, 3);
  const topChannels = dashboard?.topChannels ?? [];

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Report Center</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">报表中心</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              把 dashboard、analytics、工单、留言、知识和会话历史组合成一页式运营报表，给管理侧一个稳定入口。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近刷新：{formatDateTime(dashboard?.lastRefreshedAt ?? analytics?.lastRefreshedAt)}
            <div className="mt-1 text-xs text-slate-500">报表数据均来自现有 hooks</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportSummary.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">运营洞察</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">insight</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-slate-50 p-4">
              <p className="text-sm text-slate-500">开放工单</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {tickets.filter((ticket) => ticket.status.toLowerCase().includes('open')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">优先关注高 SLA 风险单</p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-50 p-4">
              <p className="text-sm text-slate-500">待处理留言</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {leaveMessages.filter((item) => item.status.toLowerCase().includes('pending')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">待分配给客服组处理</p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-50 p-4">
              <p className="text-sm text-slate-500">已发布知识</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {knowledge.filter((item) => item.status.toLowerCase().includes('published')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">支撑机器人回答与人工检索</p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-50 p-4">
              <p className="text-sm text-slate-500">已结束会话</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {history.filter((item) => item.status.toLowerCase().includes('ended')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">可直接进入历史复盘</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">管理建议</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              先处理高优先级工单和待分配留言，再看知识发布率与会话满意度。这个页面适合管理层每日巡检。
            </p>
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">高频渠道</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">channels</span>
            </div>
            <div className="mt-4 space-y-3">
              {topChannels.length > 0 ? (
                topChannels.map((channel) => (
                  <div key={channel.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{channel.name}</span>
                      <span className="text-xs text-slate-500">{channel.code}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {channel.is_active ? '活跃' : '未启用'} · {channel.base_url}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无渠道数据。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">知识与会话快照</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">snapshot</span>
            </div>

            <div className="mt-4 space-y-3">
              {topDocuments.slice(0, 2).map((document) => (
                <div key={document.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{document.title}</span>
                    <span className="text-xs text-slate-500">{document.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {document.category} · {document.type} · v{document.version}
                  </p>
                </div>
              ))}
              {topConversations.slice(0, 2).map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">会话 #{item.id}</span>
                    <span className="text-xs text-slate-500">{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.channel ?? '未知渠道'} · 负责人 {item.assignee ?? '未分配'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">快速入口</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">actions</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/service-ops" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                服务运营台
              </Link>
              <Link to="/quality-review" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
                质检评分
              </Link>
              <Link to="/export-management" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                导出管理
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
