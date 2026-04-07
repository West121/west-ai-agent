import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';

import {
  useCreateLeaveMessage,
  useCreateTicket,
  useLeaveMessages,
  useTickets,
  useUpdateLeaveMessage,
  useUpdateTicket,
} from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('open') || normalized.includes('new') || normalized.includes('pending')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized.includes('progress') || normalized.includes('assigned') || normalized.includes('doing')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized.includes('done') || normalized.includes('closed') || normalized.includes('resolved')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function priorityTone(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized.includes('urgent') || normalized.includes('high') || normalized.includes('p0')) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized.includes('medium') || normalized.includes('normal') || normalized.includes('p1')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function localDateTimeToIso(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  if (!text) {
    return undefined;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function ServiceOpsPage() {
  const ticketsQuery = useTickets();
  const leaveMessagesQuery = useLeaveMessages();
  const createTicketMutation = useCreateTicket();
  const updateTicketMutation = useUpdateTicket();
  const createLeaveMessageMutation = useCreateLeaveMessage();
  const updateLeaveMessageMutation = useUpdateLeaveMessage();

  const tickets = ticketsQuery.data ?? [];
  const leaveMessages = leaveMessagesQuery.data ?? [];
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedLeaveMessageId, setSelectedLeaveMessageId] = useState<number | null>(null);

  useEffect(() => {
    if (tickets.length > 0 && selectedTicketId === null) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  useEffect(() => {
    if (leaveMessages.length > 0 && selectedLeaveMessageId === null) {
      setSelectedLeaveMessageId(leaveMessages[0].id);
    }
  }, [leaveMessages, selectedLeaveMessageId]);

  const selectedTicket = tickets.find((item) => item.id === selectedTicketId) ?? tickets[0] ?? null;
  const selectedLeaveMessage =
    leaveMessages.find((item) => item.id === selectedLeaveMessageId) ?? leaveMessages[0] ?? null;

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const response = await createTicketMutation.mutateAsync({
      title: requiredText(formData.get('title')),
      status: optionalText(formData.get('status')),
      priority: optionalText(formData.get('priority')),
      source: optionalText(formData.get('source')),
      customer_profile_id: optionalNumber(formData.get('customer_profile_id')) ?? null,
      conversation_id: optionalNumber(formData.get('conversation_id')) ?? null,
      assignee: optionalText(formData.get('assignee')) ?? null,
      assignee_group: optionalText(formData.get('assignee_group')) ?? null,
      summary: optionalText(formData.get('summary')) ?? null,
      sla_due_at: localDateTimeToIso(formData.get('sla_due_at')) ?? null,
    });

    event.currentTarget.reset();
    setSelectedTicketId(response.id);
  }

  async function handleUpdateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTicketId === null) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    await updateTicketMutation.mutateAsync({
      ticketId: selectedTicketId,
      payload: {
        status: optionalText(formData.get('status')),
        priority: optionalText(formData.get('priority')),
        assignee: optionalText(formData.get('assignee')) ?? null,
        summary: optionalText(formData.get('summary')) ?? null,
      },
    });
  }

  async function handleCreateLeaveMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const response = await createLeaveMessageMutation.mutateAsync({
      visitor_name: requiredText(formData.get('visitor_name')),
      phone: optionalText(formData.get('phone')) ?? null,
      email: optionalText(formData.get('email')) ?? null,
      source: optionalText(formData.get('source')),
      status: optionalText(formData.get('status')),
      subject: requiredText(formData.get('subject')),
      content: requiredText(formData.get('content')),
      assigned_group: optionalText(formData.get('assigned_group')) ?? null,
    });

    event.currentTarget.reset();
    setSelectedLeaveMessageId(response.id);
  }

  async function handleUpdateLeaveMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedLeaveMessageId === null) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    await updateLeaveMessageMutation.mutateAsync({
      leaveMessageId: selectedLeaveMessageId,
      payload: {
        status: optionalText(formData.get('status')),
        assigned_group: optionalText(formData.get('assigned_group')) ?? null,
        subject: optionalText(formData.get('subject')),
        content: optionalText(formData.get('content')),
      },
    });
  }

  if (ticketsQuery.isLoading || leaveMessagesQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (ticketsQuery.isError || leaveMessagesQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">服务运营失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 service 相关数据</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {ticketsQuery.error instanceof ApiError
            ? ticketsQuery.error.detail
            : leaveMessagesQuery.error instanceof ApiError
              ? leaveMessagesQuery.error.detail
              : '请求 service 接口失败'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)] xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Service Ops</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">服务运营台</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这里把工单与留言合并成一个可操作的后台工作台，直接接入 `GET/POST/PATCH /service/*` 接口。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/tickets"
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
            >
              工单列表
            </Link>
            <Link
              to="/leave-messages"
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
            >
              留言列表
            </Link>
            <Link
              to="/analytics"
              className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
            >
              分析看板
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">工单总数</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{tickets.length}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">来自 `/service/tickets`</p>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">开放工单</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {tickets.filter((item) => item.status.toLowerCase().includes('open')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">按状态本地统计</p>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">留言总数</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{leaveMessages.length}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">来自 `/service/leave-messages`</p>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">待处理留言</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {leaveMessages.filter((item) => item.status.toLowerCase().includes('pending')).length}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">可直接更新状态与分组</p>
            </article>
          </div>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">运营摘要</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">summary</span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-3">
                <dt className="text-sm text-slate-500">高优先级工单</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {tickets.filter((item) => item.priority.toLowerCase().includes('high') || item.priority.toLowerCase().includes('urgent')).length}
                </dd>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <dt className="text-sm text-slate-500">待处理留言</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {leaveMessages.filter((item) => item.status.toLowerCase().includes('pending')).length}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">处理建议</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">next step</span>
            </div>
            <div className="mt-4 rounded-2xl border border-sky-200 bg-white p-4 text-sm leading-6 text-slate-700">
              <p className="font-medium text-slate-900">当前处理建议</p>
              <p className="mt-2">建议先补充处理步骤</p>
              <p className="mt-2">并将工单与留言统一分配到对应组，避免重复跟进。</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/tickets"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                创建工单
              </Link>
              <Link
                to="/leave-messages"
                className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
              >
                查看留言
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">工单列表</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {tickets.length} 条
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => {
              const selected = ticket.id === selectedTicket?.id;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={[
                    'block w-full rounded-[1.25rem] border p-4 text-left transition',
                    selected
                      ? 'border-sky-200 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{ticket.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        #{ticket.id} · {ticket.assignee ?? '未分配'} · {ticket.assignee_group ?? '未分组'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityTone(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {ticket.source}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{ticket.summary ?? '暂无摘要'}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    创建于 {formatDateTime(ticket.created_at)} · 更新于 {formatDateTime(ticket.updated_at)}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedTicket ? (
            <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">当前选中工单</p>
              <p className="mt-2">标题：{selectedTicket.title}</p>
              <p className="mt-1">客户：{selectedTicket.customer_profile_id ?? '未关联'}</p>
              <p className="mt-1">会话：{selectedTicket.conversation_id ?? '未关联'}</p>
              <p className="mt-1">SLA：{formatDateTime(selectedTicket.sla_due_at)}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              暂无工单可选。
            </div>
          )}
        </section>

        <section className="grid gap-6">
          <form
            onSubmit={handleCreateTicket}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">新建工单</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                POST /service/tickets
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">标题</span>
                <input
                  name="title"
                  required
                  placeholder="退款工单"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">状态</span>
                <input
                  name="status"
                  defaultValue="open"
                  placeholder="open"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">优先级</span>
                <input
                  name="priority"
                  defaultValue="normal"
                  placeholder="normal"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">来源</span>
                <input
                  name="source"
                  defaultValue="web"
                  placeholder="web"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">客户 ID</span>
                <input
                  name="customer_profile_id"
                  type="number"
                  min="1"
                  placeholder="可选"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">会话 ID</span>
                <input
                  name="conversation_id"
                  type="number"
                  min="1"
                  placeholder="可选"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">负责人</span>
                <input
                  name="assignee"
                  placeholder="agent-a"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">负责组</span>
                <input
                  name="assignee_group"
                  placeholder="售后组"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">摘要</span>
                <textarea
                  name="summary"
                  rows={3}
                  placeholder="用户咨询退款到账时效"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">SLA 到期时间</span>
                <input
                  name="sla_due_at"
                  type="datetime-local"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={createTicketMutation.isPending}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createTicketMutation.isPending ? '创建中...' : '创建工单'}
            </button>

            {createTicketMutation.isError ? (
              <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {createTicketMutation.error instanceof ApiError
                  ? createTicketMutation.error.detail
                  : '创建工单失败'}
              </div>
            ) : null}

            {createTicketMutation.data ? (
              <div className="mt-4 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                已创建工单 #{createTicketMutation.data.id}，列表会自动刷新。
              </div>
            ) : null}
          </form>

          <form
            key={selectedTicket?.id ?? 'empty-ticket'}
            onSubmit={handleUpdateTicket}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">更新选中工单</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                PATCH /service/tickets/{selectedTicket?.id ?? '-'}
              </span>
            </div>

            {selectedTicket ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">状态</span>
                  <input
                    name="status"
                    defaultValue={selectedTicket.status}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">优先级</span>
                  <input
                    name="priority"
                    defaultValue={selectedTicket.priority}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">负责人</span>
                  <input
                    name="assignee"
                    defaultValue={selectedTicket.assignee ?? ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">摘要</span>
                  <textarea
                    name="summary"
                    rows={3}
                    defaultValue={selectedTicket.summary ?? ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有选中的工单。
              </div>
            )}

            <button
              type="submit"
              disabled={updateTicketMutation.isPending || !selectedTicket}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {updateTicketMutation.isPending ? '更新中...' : '更新工单'}
            </button>

            {updateTicketMutation.isError ? (
              <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {updateTicketMutation.error instanceof ApiError
                  ? updateTicketMutation.error.detail
                  : '更新工单失败'}
              </div>
            ) : null}
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">留言列表</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {leaveMessages.length} 条
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {leaveMessages.map((message) => {
              const selected = message.id === selectedLeaveMessage?.id;
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedLeaveMessageId(message.id)}
                  className={[
                    'block w-full rounded-[1.25rem] border p-4 text-left transition',
                    selected
                      ? 'border-sky-200 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{message.visitor_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{message.subject}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(message.status)}`}>
                      {message.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {message.source}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {message.assigned_group ?? '未分组'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{message.content ?? '暂无内容'}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    创建于 {formatDateTime(message.created_at)} · 更新于 {formatDateTime(message.updated_at)}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedLeaveMessage ? (
            <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">当前选中留言</p>
              <p className="mt-2">访客：{selectedLeaveMessage.visitor_name}</p>
              <p className="mt-1">电话：{selectedLeaveMessage.phone ?? '暂无'}</p>
              <p className="mt-1">邮箱：{selectedLeaveMessage.email ?? '暂无'}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              暂无留言可选。
            </div>
          )}
        </section>

        <section className="grid gap-6">
          <form
            onSubmit={handleCreateLeaveMessage}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">新建留言</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                POST /service/leave-messages
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">访客姓名</span>
                <input
                  name="visitor_name"
                  required
                  placeholder="张晓晴"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">电话</span>
                <input
                  name="phone"
                  placeholder="13800000000"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">邮箱</span>
                <input
                  name="email"
                  type="email"
                  placeholder="zxq@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">来源</span>
                <input
                  name="source"
                  defaultValue="h5"
                  placeholder="h5"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">状态</span>
                <input
                  name="status"
                  defaultValue="pending"
                  placeholder="pending"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">主题</span>
                <input
                  name="subject"
                  required
                  placeholder="售后跟进"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">内容</span>
                <textarea
                  name="content"
                  rows={4}
                  required
                  placeholder="希望客服回访退货进度"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">分组</span>
                <input
                  name="assigned_group"
                  placeholder="售后组"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={createLeaveMessageMutation.isPending}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createLeaveMessageMutation.isPending ? '创建中...' : '创建留言'}
            </button>

            {createLeaveMessageMutation.isError ? (
              <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {createLeaveMessageMutation.error instanceof ApiError
                  ? createLeaveMessageMutation.error.detail
                  : '创建留言失败'}
              </div>
            ) : null}

            {createLeaveMessageMutation.data ? (
              <div className="mt-4 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                已创建留言 #{createLeaveMessageMutation.data.id}，列表会自动刷新。
              </div>
            ) : null}
          </form>

          <form
            key={selectedLeaveMessage?.id ?? 'empty-leave-message'}
            onSubmit={handleUpdateLeaveMessage}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">更新选中留言</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                PATCH /service/leave-messages/{selectedLeaveMessage?.id ?? '-'}
              </span>
            </div>

            {selectedLeaveMessage ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">状态</span>
                  <input
                    name="status"
                    defaultValue={selectedLeaveMessage.status}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">分组</span>
                  <input
                    name="assigned_group"
                    defaultValue={selectedLeaveMessage.assigned_group ?? ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">主题</span>
                  <input
                    name="subject"
                    defaultValue={selectedLeaveMessage.subject}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">内容</span>
                  <textarea
                    name="content"
                    rows={4}
                    defaultValue={selectedLeaveMessage.content ?? ''}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有选中的留言。
              </div>
            )}

            <button
              type="submit"
              disabled={updateLeaveMessageMutation.isPending || !selectedLeaveMessage}
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {updateLeaveMessageMutation.isPending ? '更新中...' : '更新留言'}
            </button>

            {updateLeaveMessageMutation.isError ? (
              <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                {updateLeaveMessageMutation.error instanceof ApiError
                  ? updateLeaveMessageMutation.error.detail
                  : '更新留言失败'}
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </section>
  );
}
