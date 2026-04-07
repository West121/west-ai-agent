import { useMemo, useState } from 'react';

import { Link } from '@tanstack/react-router';

import { HorizontalBars, SparklineTrend, StackedBars } from '@/components/chart-primitives';
import { useAnalytics } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

type AnalyticsScope = 'all' | 'conversation' | 'service';
type WindowRange = 7 | 14 | 30;

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
    </article>
  );
}

function filterButtonClass(active: boolean) {
  return [
    'rounded-full border px-4 py-2 text-sm font-medium transition',
    active
      ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700',
  ].join(' ');
}

export function AnalyticsPage() {
  const query = useAnalytics();
  const [scope, setScope] = useState<AnalyticsScope>('all');
  const [windowDays, setWindowDays] = useState<WindowRange>(7);
  const data = query.data;
  const conversationAnalytics = data?.conversationAnalytics;
  const serviceAnalytics = data?.serviceAnalytics;
  const lastTrend = conversationAnalytics?.trend.at(-1);
  const visibleConversationTrend = useMemo(
    () => conversationAnalytics?.trend.slice(-windowDays) ?? [],
    [conversationAnalytics?.trend, windowDays],
  );
  const visibleServiceTrend = useMemo(
    () => serviceAnalytics?.trend.slice(-windowDays) ?? [],
    [serviceAnalytics?.trend, windowDays],
  );
  const showConversation = scope !== 'service';
  const showService = scope !== 'conversation';

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

  if (!data || !conversationAnalytics || !serviceAnalytics) {
    return null;
  }

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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            范围
          </span>
          <button type="button" className={filterButtonClass(scope === 'all')} onClick={() => setScope('all')}>
            全部
          </button>
          <button type="button" className={filterButtonClass(scope === 'conversation')} onClick={() => setScope('conversation')}>
            仅会话
          </button>
          <button type="button" className={filterButtonClass(scope === 'service')} onClick={() => setScope('service')}>
            仅服务
          </button>
          <span className="ml-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            窗口
          </span>
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              className={filterButtonClass(windowDays === days)}
              onClick={() => setWindowDays(days as WindowRange)}
            >
              近 {days} 天
            </button>
          ))}
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

      {showConversation ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SparklineTrend
              title={`近 ${windowDays} 天会话趋势`}
              subtitle="每日创建会话数"
              points={visibleConversationTrend.map((item) => ({ label: item.date.slice(5), value: item.created_count }))}
              tone="sky"
              actions={
                <>
                  <Link to="/history" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看会话历史
                  </Link>
                  <Link to="/analytics" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看分析明细
                  </Link>
                </>
              }
            />
            <SparklineTrend
              title={`近 ${windowDays} 天转人工趋势`}
              subtitle="每日转接到人工的次数"
              points={visibleConversationTrend.map((item) => ({ label: item.date.slice(5), value: item.transferred_count }))}
              tone="amber"
              actions={
                <>
                  <Link to="/service-ops" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看服务运营台
                  </Link>
                  <Link to="/tickets" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看工单列表
                  </Link>
                </>
              }
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
              actions={
                <>
                  <Link to="/history" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    钻取会话明细
                  </Link>
                  <Link to="/analytics" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    打开总览
                  </Link>
                </>
              }
            />
            <HorizontalBars
              title="渠道分布"
              subtitle="当前窗口内高频渠道"
              items={conversationAnalytics.channel_distribution.map((item, index) => ({
                ...item,
                tone: (['emerald', 'sky', 'violet', 'amber', 'rose'] as const)[index % 5],
              }))}
              actions={
                <>
                  <Link to="/conversations" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看会话列表
                  </Link>
                  <Link to="/service-ops" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看服务运营
                  </Link>
                </>
              }
            />
          </div>
        </>
      ) : null}

      {showService ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SparklineTrend
              title={`近 ${windowDays} 天工单趋势`}
              subtitle="每日新增工单数量"
              points={visibleServiceTrend.map((item) => ({ label: item.date.slice(5), value: item.ticket_count }))}
              tone="rose"
              actions={
                <>
                  <Link to="/tickets" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看工单列表
                  </Link>
                  <Link to="/service-ops" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看处理台
                  </Link>
                </>
              }
            />
            <SparklineTrend
              title={`近 ${windowDays} 天留言趋势`}
              subtitle="每日新增留言数量"
              points={visibleServiceTrend.map((item) => ({ label: item.date.slice(5), value: item.leave_message_count }))}
              tone="violet"
              actions={
                <>
                  <Link to="/leave-messages" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看留言列表
                  </Link>
                  <Link to="/export-management" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看导出
                  </Link>
                </>
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <StackedBars
              title="工单状态分布"
              subtitle="当前窗口内工单状态聚合"
              items={serviceAnalytics.distribution.ticket_status.map((item, index) => ({
                ...item,
                tone: (['rose', 'amber', 'sky', 'emerald', 'violet'] as const)[index % 5],
              }))}
              actions={
                <>
                  <Link to="/tickets" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    钻取工单明细
                  </Link>
                  <Link to="/service-ops" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    打开服务运营
                  </Link>
                </>
              }
            />
            <HorizontalBars
              title="工单优先级分布"
              subtitle="当前窗口内工单优先级"
              items={serviceAnalytics.distribution.ticket_priority.map((item, index) => ({
                ...item,
                tone: (['rose', 'amber', 'sky', 'emerald', 'violet'] as const)[index % 5],
              }))}
              actions={
                <>
                  <Link to="/tickets" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                    查看工单列表
                  </Link>
                  <Link to="/leave-messages" className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    查看留言列表
                  </Link>
                </>
              }
            />
          </div>
        </>
      ) : null}

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
              <div className="flex min-h-44 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                暂无最近摘要
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
