import { useState, type FormEvent } from 'react';

import { Link } from '@tanstack/react-router';

import { ModeShell } from '@/components/mode-shell';
import { submitLeaveMessage, type LeaveMessageInput } from '@/lib/customer-h5-api';

type LeaveMessageFormState = {
  visitor_name: string;
  phone: string;
  email: string;
  source: string;
  subject: string;
  content: string;
  assigned_group: string;
};

const defaultForm: LeaveMessageFormState = {
  visitor_name: '匿名访客',
  phone: '',
  email: '',
  source: 'customer_h5',
  subject: '人工客服留言',
  content: '',
  assigned_group: 'general',
};

function renderResponseSummary(value: unknown): string {
  if (value === undefined) {
    return '后端未返回内容，留言已提交。';
  }

  if (value === null) {
    return '后端返回空值，留言已提交。';
  }

  if (typeof value !== 'object') {
    return `留言已提交：${String(value)}`;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return '留言已提交，后端返回空对象。';
  }

  return `留言已提交，返回了 ${keys.length} 个字段。`;
}

export function LeaveMessagePage() {
  const [form, setForm] = useState<LeaveMessageFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(undefined);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitted(false);

    try {
      const payload: LeaveMessageInput = {
        visitor_name: form.visitor_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        source: form.source.trim() || 'customer_h5',
        subject: form.subject.trim() || '人工客服留言',
        content: form.content.trim(),
        assigned_group: form.assigned_group.trim() || null,
      };

      if (!payload.visitor_name || !payload.content) {
        throw new Error('访客姓名和留言内容不能为空');
      }

      const response = await submitLeaveMessage(payload);
      setResult(response);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '留言提交失败');
      setResult(undefined);
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModeShell mode="standalone">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-soft backdrop-blur sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Leave Message</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">留言页</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            人工坐席不可用或访客离开时，提交留言并保留后续联系信息。
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  visitor_name
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  value={form.visitor_name}
                  onChange={(event) => setForm((current) => ({ ...current, visitor_name: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  source
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
            phone
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  email
                </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            inputMode="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  subject
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  assigned_group
                </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            value={form.assigned_group}
            onChange={(event) =>
              setForm((current) => ({ ...current, assigned_group: event.target.value }))
            }
          />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                content
              </span>
              <textarea
                className="min-h-[180px] w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                接口路径：`POST /service/leave-messages`
              </p>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? '提交中...' : '提交留言'}
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {submitted && !error ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {renderResponseSummary(result)}
              </div>
            ) : null}
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-soft backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">空态</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              如果后端没有返回提交结果，页面会提示“已提交但未返回内容”。这会在接口只返回 204 或空对象时出现。
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-soft backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Navigation</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white" to="/">
                Home
              </Link>
              <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700" to="/standalone">
                Chat
              </Link>
              <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700" to="/embedded">
                Embedded
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </ModeShell>
  );
}
