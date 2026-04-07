import { Link } from '@tanstack/react-router';

import { useAnalytics } from '@/hooks/use-platform-api';
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

export function AnalyticsPage() {
  const query = useAnalytics();

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
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
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">分析失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 conversation analytics</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError ? query.error.detail : '请求分析数据失败'}
        </p>
      </section>
    );
  }

  const data = query.data;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Analytics</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">会话分析</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              通过历史列表和每条会话的 summary 接口生成聚合指标，没有依赖新后端接口。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近刷新：{formatDateTime(data?.lastRefreshedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="历史会话"
            value={`${data?.historyCount ?? 0}`}
            hint="来自 /conversation/conversations/history"
          />
          <MetricCard
            label="摘要覆盖"
            value={`${data?.summaryCount ?? 0}`}
            hint="成功调用 summary 接口的会话数"
          />
          <MetricCard
            label="总消息数"
            value={`${data?.totalMessages ?? 0}`}
            hint="summary.message_count 聚合"
          />
          <MetricCard
            label="平均满意度"
            value={data?.averageSatisfaction !== null && data?.averageSatisfaction !== undefined ? `${data.averageSatisfaction}` : '暂无'}
            hint="summary.satisfaction_score 平均值"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">最近摘要</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">summary</span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(data?.recentItems ?? []).length > 0 ? (
              data!.recentItems.map((item) => (
                <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">会话 #{item.id}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        客户 {item.customer_profile_id} · {item.channel ?? '未知渠道'}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {item.message_count} messages
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.ai_summary ?? '暂无摘要'}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    满意度：{item.satisfaction_score ?? '暂无'} · 最近消息 {formatDateTime(item.last_message_at)}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                暂无最近摘要数据。
              </div>
            )}
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">运营摘要</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">ops</span>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">历史会话</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{data?.historyCount ?? 0}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">摘要覆盖</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{data?.summaryCount ?? 0}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">总消息数</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{data?.totalMessages ?? 0}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-sm text-slate-500">平均满意度</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {data?.averageSatisfaction !== null && data?.averageSatisfaction !== undefined
                    ? `${data.averageSatisfaction}`
                    : '暂无'}
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
              <Link
                to="/service-ops"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                服务运营台
              </Link>
              <Link
                to="/history"
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
              >
                会话历史
              </Link>
              <Link
                to="/knowledge-studio"
                className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
              >
                知识工坊
              </Link>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">最近高频渠道</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">channels</span>
            </div>
            <div className="mt-4 space-y-3">
              {(data?.channelBreakdown ?? []).length > 0 ? (
                data!.channelBreakdown.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{item.label}</span>
                      <span className="text-sm font-semibold text-slate-700">{item.value}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.max(8, Math.min(100, item.value * 20))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无渠道统计。
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">状态分布</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">history</span>
          </div>
          <div className="mt-4 space-y-3">
            {(data?.statusBreakdown ?? []).length > 0 ? (
              data!.statusBreakdown.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-700">{item.value}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{ width: `${Math.max(8, Math.min(100, item.value * 20))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                暂无状态统计。
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
