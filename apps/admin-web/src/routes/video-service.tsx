import { Link } from '@tanstack/react-router';

import { useConversations, useCustomers, useTickets } from '@/hooks/use-platform-api';
import { ApiError } from '@/lib/platform-api';

export function VideoServicePage() {
  const conversationsQuery = useConversations();
  const customersQuery = useCustomers();
  const ticketsQuery = useTickets();

  const conversations = conversationsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const activeConversation = conversations.find((item) => !item.status.toLowerCase().includes('ended')) ?? conversations[0] ?? null;
  const customer = customers.find((item) => item.id === activeConversation?.customer_profile_id) ?? customers[0] ?? null;

  if (conversationsQuery.isLoading || customersQuery.isLoading || ticketsQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (conversationsQuery.isError || customersQuery.isError || ticketsQuery.isError) {
    const detail =
      conversationsQuery.error instanceof ApiError
        ? conversationsQuery.error.detail
        : customersQuery.error instanceof ApiError
          ? customersQuery.error.detail
          : ticketsQuery.error instanceof ApiError
            ? ticketsQuery.error.detail
            : '请求视频客服数据失败';
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">视频客服失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成视频客服页面</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{detail}</p>
      </section>
    );
  }

  const relatedTickets = tickets.filter((item) => item.conversation_id === activeConversation?.id).slice(0, 3);

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Video Service</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">视频客服</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              用现有会话、客户和工单数据拼出视频服务工作台，给人工协作留一个清晰的坐席入口。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              开始视频服务
            </button>
            <Link to="/service-ops" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              返回服务运营台
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">主视频舞台</p>
                <h3 className="mt-1 text-xl font-semibold">{customer?.name ?? '等待接入客户'}</h3>
              </div>
              <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">录制中</span>
            </div>
          </div>
          <div className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%),linear-gradient(180deg,#0f172a,#111827)] p-8 text-slate-200">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Live Video Session</p>
              <p className="mt-4 text-2xl font-semibold">{activeConversation ? `会话 #${activeConversation.id}` : '暂无活跃视频会话'}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {customer?.phone ?? customer?.email ?? '等待客户设备接入摄像头与麦克风'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
              转工单
            </button>
            <button type="button" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              抓拍记录
            </button>
            <button type="button" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
              结束服务
            </button>
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">会话信息</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">session</span>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>状态：{activeConversation?.status ?? '暂无'}</p>
              <p>负责人：{activeConversation?.assignee ?? '未分配'}</p>
              <p>渠道：{activeConversation?.channel ?? '未知'}</p>
              <p>客户：{customer?.name ?? '未匹配'}</p>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">关联工单</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">tickets</span>
            </div>
            <div className="mt-4 space-y-3">
              {relatedTickets.length > 0 ? (
                relatedTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{ticket.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {ticket.status} · {ticket.priority}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无关联工单，可直接创建。
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
