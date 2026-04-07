import { useDashboardSummary } from '@/hooks/use-platform-api';
import { formatCount, formatDateTime, formatDateTimeRelative } from '@/lib/format';

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

function ListCard({
  title,
  items,
}: {
  title: string;
  items: { primary: string; secondary: string; meta?: string }[];
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          真实接口
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={`${item.primary}-${item.secondary}`} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.primary}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.secondary}</p>
                </div>
                {item.meta ? (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {item.meta}
                  </span>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            暂无数据
          </div>
        )}
      </div>
    </section>
  );
}

export function HomePage() {
  const query = useDashboardSummary();

  if (query.isLoading) {
    return (
      <section className="grid gap-6">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-4 h-8 w-96 max-w-full animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-3 h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-slate-100" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[1.35rem] bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">加载失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法获取平台摘要</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof Error ? query.error.message : '请求平台接口失败'}
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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Platform Overview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              平台运营摘要已接入真实后端数据
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              首页不再展示固定占位内容，而是并行拉取客户、知识、渠道和会话列表，用现有接口直接计算运营摘要。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近刷新：{formatDateTimeRelative(data?.lastRefreshedAt)}
            <div className="mt-1 text-xs text-slate-500">{formatDateTime(data?.lastRefreshedAt)}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="客户数"
            value={formatCount(data?.customerCount ?? 0)}
            hint="来自 /customer/profiles 列表接口"
          />
          <MetricCard
            label="知识数"
            value={formatCount(data?.knowledgeCount ?? 0)}
            hint="来自 /knowledge/documents 列表接口"
          />
          <MetricCard
            label="渠道数"
            value={formatCount(data?.channelCount ?? 0)}
            hint="来自 /channels/apps 列表接口"
          />
          <MetricCard
            label="会话数"
            value={formatCount(data?.conversationCount ?? 0)}
            hint="来自 /conversation/conversations 列表接口"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="活跃渠道"
              value={formatCount(data?.activeChannelCount ?? 0)}
              hint="根据渠道 is_active 字段计算"
            />
            <MetricCard
              label="草稿知识"
              value={formatCount(data?.draftKnowledgeCount ?? 0)}
              hint="根据知识 status = draft 统计"
            />
            <MetricCard
              label="开放会话"
              value={formatCount(data?.openConversationCount ?? 0)}
              hint="根据会话 status != ended 统计"
            />
          </div>

          <ListCard
            title="客户摘要"
            items={
              data?.topCustomers.map((item) => ({
                primary: item.name,
                secondary: `${item.external_id}${item.email ? ` · ${item.email}` : ''}`,
                meta: item.status,
              })) ?? []
            }
          />
        </div>

        <div className="grid gap-6">
          <ListCard
            title="知识文档"
            items={
              data?.topKnowledgeDocuments.map((item) => ({
                primary: item.title,
                secondary: `${item.category} · ${item.language} · ${item.type}`,
                meta: item.status,
              })) ?? []
            }
          />

          <ListCard
            title="渠道与会话"
            items={
              [
                ...(data?.topChannels.map((item) => ({
                  primary: item.name,
                  secondary: item.base_url,
                  meta: item.is_active ? 'active' : 'inactive',
                })) ?? []),
                ...(data?.topConversations.map((item) => ({
                  primary: `会话 #${item.id}`,
                  secondary: `客户 ${item.customer_profile_id} · ${item.assignee ?? '未分配'}`,
                  meta: item.status,
                })) ?? []),
              ].slice(0, 4)
            }
          />
        </div>
      </div>
    </section>
  );
}

