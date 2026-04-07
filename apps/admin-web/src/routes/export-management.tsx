import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  useCompleteExportTask,
  useCreateExportTask,
  useExecuteExportTask,
  useExportTask,
  useExportTasks,
} from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

const SOURCE_OPTIONS = [
  { value: 'tickets', label: '工单导出', hint: 'service/tickets 记录' },
  { value: 'leave_messages', label: '留言导出', hint: 'service/leave-messages 记录' },
  { value: 'conversation_history', label: '会话归档', hint: 'conversation history 记录' },
  { value: 'knowledge_documents', label: '知识快照', hint: '已发布知识文档' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
] as const;

function StatCard({
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

function sourceLabel(sourceKind: string) {
  return SOURCE_OPTIONS.find((option) => option.value === sourceKind)?.label ?? sourceKind;
}

function sourceHint(sourceKind: string) {
  return SOURCE_OPTIONS.find((option) => option.value === sourceKind)?.hint ?? sourceKind;
}

export function ExportManagementPage() {
  const tasksQuery = useExportTasks();
  const createMutation = useCreateExportTask();
  const executeMutation = useExecuteExportTask();
  const completeMutation = useCompleteExportTask();

  const tasks = tasksQuery.data ?? [];
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const selectedTaskQuery = useExportTask(selectedTaskId);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [name, setName] = useState('工单与留言日报');
  const [sourceKind, setSourceKind] = useState<(typeof SOURCE_OPTIONS)[number]['value']>('tickets');
  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]['value']>('csv');

  useEffect(() => {
    if (selectedTaskId === null && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [selectedTaskId, tasks]);

  const summary = useMemo(() => {
    const running = tasks.filter((task) => task.status === 'running').length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const totalRows = tasks.reduce((sum, task) => sum + (task.row_count ?? 0), 0);

    return { running, completed, pending, totalRows, total: tasks.length };
  }, [tasks]);

  if (tasksQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (tasksQuery.isError) {
    const detail = tasksQuery.error instanceof ApiError ? tasksQuery.error.detail : '请求导出任务失败';

    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">导出失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法加载导出任务</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{detail}</p>
      </section>
    );
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const task = await createMutation.mutateAsync({
        name: name.trim(),
        source_kind: sourceKind,
        format,
      });
      setSelectedTaskId(task.id);
      setFeedback(`已创建导出任务：${task.name}`);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.detail : '创建导出任务失败');
    }
  }

  async function executeTask(taskId: number) {
    try {
      const task = await executeMutation.mutateAsync(taskId);
      setSelectedTaskId(task.id);
      setFeedback(`已触发执行：${task.name}，预计导出 ${task.row_count ?? 0} 条`);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.detail : '触发执行失败');
    }
  }

  async function completeTask(taskId: number) {
    try {
      const task = await completeMutation.mutateAsync(taskId);
      setSelectedTaskId(task.id);
      setFeedback(`已完成导出：${task.name}`);
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.detail : '标记完成失败');
    }
  }

  const selectedTask = selectedTaskQuery.data ?? null;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Export Management</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">导出管理</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                管理真实导出任务，支持创建、执行、完成和下载链接查看。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/report-center"
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
              >
                前往报表中心
              </a>
              <button
                type="button"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                导出任务工作台
              </button>
            </div>
          </div>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {feedback}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="任务总数" value={String(summary.total)} hint="export_tasks 记录数" />
            <StatCard label="待执行" value={String(summary.pending)} hint="pending 状态" />
            <StatCard label="执行中" value={String(summary.running)} hint="running 状态" />
            <StatCard label="已完成" value={String(summary.completed)} hint="completed 状态" />
            <StatCard label="导出条数" value={String(summary.totalRows)} hint="所有任务 row_count 汇总" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">创建导出任务</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">create</span>
            </div>

            <form className="mt-4 grid gap-4" onSubmit={createTask}>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                任务名称
                <input
                  aria-label="任务名称"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400"
                  placeholder="例如：工单与留言日报"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                导出来源
                <select
                  aria-label="导出来源"
                  value={sourceKind}
                  onChange={(event) => setSourceKind(event.target.value as (typeof SOURCE_OPTIONS)[number]['value'])}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400"
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                导出格式
                <select
                  aria-label="导出格式"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as (typeof FORMAT_OPTIONS)[number]['value'])}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400"
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {createMutation.isPending ? '创建中...' : '创建导出任务'}
              </button>

              <p className="text-xs leading-5 text-slate-500">
                {sourceHint(sourceKind)} · 默认会生成一个可完成并下载的任务记录。
              </p>
            </form>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">导出任务列表</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">tasks</span>
            </div>

            <div className="mt-4 space-y-3">
              {tasks.length > 0 ? (
                tasks.map((task) => {
                  const isSelected = task.id === selectedTaskId;
                  return (
                    <article
                      key={task.id}
                      className={[
                        'rounded-2xl border p-4 transition',
                        isSelected ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{task.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {sourceLabel(task.source_kind)} · {task.format.toUpperCase()}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {task.status}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {sourceHint(task.source_kind)}
                        {task.row_count !== null ? ` · ${task.row_count} 条` : ''}
                      </p>

                      {task.download_url ? (
                        <p className="mt-2 break-all text-xs leading-5 text-sky-700">{task.download_url}</p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
                          onClick={() => void executeTask(task.id)}
                          disabled={executeMutation.isPending}
                        >
                          触发执行
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-emerald-100 disabled:text-emerald-300"
                          onClick={() => void completeTask(task.id)}
                          disabled={completeMutation.isPending}
                        >
                          标记完成
                        </button>
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        最近更新时间：{formatDateTime(task.updated_at)}
                      </p>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无导出任务，先创建一个任务。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <aside className="grid gap-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">详情</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">detail</span>
          </div>

          {selectedTaskQuery.isLoading ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
          ) : selectedTask ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">任务名称</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{selectedTask.name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p>状态：{selectedTask.status}</p>
                <p>来源：{sourceLabel(selectedTask.source_kind)}</p>
                <p>格式：{selectedTask.format}</p>
                <p>条数：{selectedTask.row_count ?? 0}</p>
                <p>开始时间：{selectedTask.started_at ? formatDateTime(selectedTask.started_at) : '暂无'}</p>
                <p>完成时间：{selectedTask.completed_at ? formatDateTime(selectedTask.completed_at) : '暂无'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">下载 URL</p>
                <p className="mt-2 break-all text-sm leading-6 text-sky-700">
                  {selectedTask.download_url ?? '任务完成后生成'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p>更新时间：{formatDateTime(selectedTask.updated_at)}</p>
                <p>创建时间：{formatDateTime(selectedTask.created_at)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">从左侧列表选择一个任务查看详情。</p>
          )}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">状态说明</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">workflow</span>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>1. 创建任务后，任务状态为 pending。</p>
            <p>2. 点击触发执行后，后端会按来源统计导出条数并切到 running。</p>
            <p>3. 点击标记完成后，系统会生成可访问的 download URL 并切到 completed。</p>
          </div>
        </section>
      </aside>
    </section>
  );
}
