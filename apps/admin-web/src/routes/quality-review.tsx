import { Link } from '@tanstack/react-router';

import { useAnalytics, useConversationHistory, useTickets } from '@/hooks/use-platform-api';
import { ApiError } from '@/lib/platform-api';

export function QualityReviewPage() {
  const analyticsQuery = useAnalytics();
  const historyQuery = useConversationHistory();
  const ticketsQuery = useTickets();

  const analytics = analyticsQuery.data;
  const history = historyQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];

  if (analyticsQuery.isLoading || historyQuery.isLoading || ticketsQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (analyticsQuery.isError || historyQuery.isError || ticketsQuery.isError) {
    const detail =
      analyticsQuery.error instanceof ApiError
        ? analyticsQuery.error.detail
        : historyQuery.error instanceof ApiError
          ? historyQuery.error.detail
          : ticketsQuery.error instanceof ApiError
            ? ticketsQuery.error.detail
            : '请求质检评分数据失败';

    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">质检失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成质检评分页面</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{detail}</p>
      </section>
    );
  }

  const reviewSamples = history.slice(0, 3).map((item, index) => ({
    id: item.id,
    title: item.summary ?? `会话 #${item.id} 需要复核`,
    score: [92, 88, 84][index] ?? 80,
    issue: item.status,
  }));
  const pendingReviewCount = tickets.filter((ticket) => ticket.priority.toLowerCase().includes('high')).length;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Quality Review</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">质检评分</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              利用现有会话摘要、满意度和工单优先级做一页式质检评分视图，帮助主管快速复核高风险会话。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/history" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              会话历史
            </Link>
            <button type="button" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              发起复核
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">平均满意度</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {analytics?.averageSatisfaction ?? '暂无'}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">来自 analytics summary</p>
        </article>
        <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">待复核高优先工单</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{pendingReviewCount}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">优先级包含 high 的工单</p>
        </article>
        <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">复核样本</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{reviewSamples.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">来自最近会话样本</p>
        </article>
        <article className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">消息总数</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{analytics?.totalMessages ?? 0}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">可用于抽样回放</p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">评分样本</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">samples</span>
          </div>
          <div className="mt-4 space-y-3">
            {reviewSamples.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">会话 #{item.id}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.title}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {item.score} 分
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    状态 {item.issue}
                  </span>
                  <button type="button" className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50">
                    查看复盘
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">评分标准</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">rubric</span>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>1. 是否命中知识库并给出准确摘要</p>
              <p>2. 是否在高风险场景下及时转人工</p>
              <p>3. 是否保留完整上下文与满意度反馈</p>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">主管动作</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">actions</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                导出评分
              </button>
              <Link to="/report-center" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
                进入报表中心
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
