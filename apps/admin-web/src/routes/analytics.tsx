import { Link } from '@tanstack/react-router';

import { EmptyChartState, HorizontalBars, SparklineTrend, StackedBars } from '@/components/chart-primitives';
import { useAnalytics } from '@/hooks/use-platform-api';
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

export function AnalyticsPage() {
  const query = useAnalytics();

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">分析失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 conversation analytics</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError ? query.error.detail : '请求分析数据失败'}
        </p>
      </section>
    );
  }

  const data = query.data!;
  const conversationAnalytics = data.conversationAnalytics;
  const serviceAnalytics = data.serviceAnalytics;
  const lastTrend = conversationAnalytics.trend.at(-1);

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Analytics</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">会话分析</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              基于后端聚合接口展示会话趋势、转人工率、满意度覆盖、响应时长和工单/留言处理状态。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近刷新：{formatDateTime(data.lastRefreshedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="摘要覆盖率"
            value={`${conversationAnalytics.hit_rate.summary_coverage_rate}%`}
            hint="AI 摘要覆盖的会话占比"
          />
          <MetricCard
            label="满意度覆盖率"
            value={`${conversationAnalytics.hit_rate.satisfaction_coverage_rate}%`}
            hint="已收集满意度反馈的会话占比"
          />
          <MetricCard
            label="高分满意度"
            value={`${conversationAnalytics.hit_rate.satisfaction_high_score_rate}%`}
            hint="评分 4 分及以上的满意度占比"
          />
          <MetricCard
            label="最近单日转人工"
            value={`${lastTrend?.transferred_count ?? 0}`}
            hint={lastTrend ? `${lastTrend.date} 当日已发生的转接次数` : '暂无趋势数据'}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SparklineTrend
          title="近 7 天会话趋势"
          subtitle="每日创建会话数"
          points={conversationAnalytics.trend.map((item) => ({ label: item.date.slice(5), value: item.created_count }))}
          tone="sky"
        />
        <SparklineTrend
          title="近 7 天转人工趋势"
          subtitle="每日转接到人工的次数"
          points={conversationAnalytics.trend.map((item) => ({ label: item.date.slice(5), value: item.transferred_count }))}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <StackedBars
          title="会话状态分布"
          subtitle="按历史会话状态聚合"
          items={conversationAnalytics.status_distribution.map((item, index) => ({
            ...item,
            tone: (['sky', 'emerald', 'amber', 'violet', 'rose'] as const)[index % 5],
          }))}
        />
        <HorizontalBars
          title="渠道分布"
          subtitle="当前窗口内高频渠道"
          items={conversationAnalytics.channel_distribution.map((item, index) => ({
            ...item,
            tone: (['emerald', 'sky', 'violet', 'amber', 'rose'] as const)[index % 5],
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SparklineTrend
          title="工单打开时长趋势"
          subtitle="按日统计开放工单平均存续时长（分钟）"
          points={serviceAnalytics.trend.map((item) => ({
            label: item.date.slice(5),
            value: Math.round(item.average_ticket_age_minutes ?? 0),
          }))}
          tone="rose"
        />
        <HorizontalBars
          title="工单优先级分布"
          subtitle="当前窗口内工单优先级"
          items={serviceAnalytics.distribution.ticket_priority.map((item, index) => ({
            ...item,
            tone: (['rose', 'amber', 'sky', 'emerald', 'violet'] as const)[index % 5],
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">运营摘要</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">ops</span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">已结束会话</dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{data.summaryCount}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">平均会话时长</dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {conversationAnalytics.duration.average_minutes ?? '暂无'} 分
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">SLA 达成率</dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {serviceAnalytics.hit_rate.sla_compliance_rate}%
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">留言分配率</dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {serviceAnalytics.hit_rate.leave_assignment_rate}%
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">快速操作</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">actions</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/report-center" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              报表中心
            </Link>
            <Link to="/quality-review" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              质检评分
            </Link>
            <Link to="/video-service" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
              视频客服
            </Link>
          </div>
          <div className="mt-4">
            {data.recentItems.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                最近摘要：{data.recentItems[0]?.ai_summary ?? '暂无摘要'}
              </div>
            ) : (
              <EmptyChartState label="暂无最近摘要" />
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
