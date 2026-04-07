import { Link } from '@tanstack/react-router';

import { HorizontalBars, SparklineTrend, StackedBars } from '@/components/chart-primitives';
import { useAnalytics, useDashboardSummary, useKnowledgeDocuments } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
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
  const knowledgeQuery = useKnowledgeDocuments();

  if (dashboardQuery.isLoading || analyticsQuery.isLoading || knowledgeQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
      </section>
    );
  }

  if (dashboardQuery.isError || analyticsQuery.isError || knowledgeQuery.isError) {
    const detail =
      dashboardQuery.error instanceof ApiError
        ? dashboardQuery.error.detail
        : analyticsQuery.error instanceof ApiError
          ? analyticsQuery.error.detail
          : knowledgeQuery.error instanceof ApiError
            ? knowledgeQuery.error.detail
            : '请求报表数据失败';

    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">报表失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成报表中心</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">{detail}</p>
      </section>
    );
  }

  const dashboard = dashboardQuery.data!;
  const analytics = analyticsQuery.data!;
  const knowledge = knowledgeQuery.data ?? [];

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Report Center</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">报表中心</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              汇总会话、工单、留言、知识与视频客服的运营指标，为主管提供每日巡检视角。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近刷新：{formatDateTime(analytics.lastRefreshedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="客户总量" value={`${dashboard.customerCount}`} hint="已注册客户档案" />
          <MetricCard label="开放会话" value={`${dashboard.openConversationCount}`} hint="当前仍在进行中的会话" />
          <MetricCard label="知识发布率" value={`${Math.round((dashboard.publishedKnowledgeCount / Math.max(knowledge.length, 1)) * 100)}%`} hint="已发布知识占比" />
          <MetricCard label="视频会话摘要覆盖" value={`${analytics.conversationAnalytics.hit_rate.summary_coverage_rate}%`} hint="视频与普通会话统一纳入摘要覆盖" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SparklineTrend
          title="近 7 天工单趋势"
          subtitle="每日新增工单数量"
          points={analytics.serviceAnalytics.trend.map((item) => ({ label: item.date.slice(5), value: item.ticket_count }))}
          tone="rose"
        />
        <SparklineTrend
          title="近 7 天留言趋势"
          subtitle="每日新增留言数量"
          points={analytics.serviceAnalytics.trend.map((item) => ({ label: item.date.slice(5), value: item.leave_message_count }))}
          tone="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <StackedBars
          title="工单状态分布"
          subtitle="当前窗口内工单状态聚合"
          items={analytics.serviceAnalytics.distribution.ticket_status.map((item, index) => ({
            ...item,
            tone: (['rose', 'amber', 'sky', 'emerald', 'violet'] as const)[index % 5],
          }))}
        />
        <HorizontalBars
          title="留言来源分布"
          subtitle="当前窗口内来源渠道"
          items={analytics.leaveSourceBreakdown.map((item, index) => ({
            ...item,
            tone: (['violet', 'sky', 'emerald', 'amber', 'rose'] as const)[index % 5],
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <HorizontalBars
          title="知识文档状态"
          subtitle="当前知识库状态分布"
          items={[
            { label: '已发布', value: dashboard.publishedKnowledgeCount, tone: 'emerald' },
            { label: '草稿', value: dashboard.draftKnowledgeCount, tone: 'amber' },
            { label: '总量', value: dashboard.knowledgeCount, tone: 'sky' },
          ]}
        />
        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">管理动作</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">actions</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/analytics" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              查看会话分析
            </Link>
            <Link to="/quality-review" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              进入质检评分
            </Link>
            <Link to="/video-service" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
              查看视频客服
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {(dashboard.topKnowledgeDocuments ?? []).slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.category} · {item.status} · 已索引 {item.indexed_chunk_count} chunks
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
