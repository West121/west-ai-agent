import { useEffect, useState, type FormEvent } from 'react';

import {
  useCreateKnowledgeDocument,
  useKnowledgeDocument,
  useKnowledgeDocuments,
  usePublishKnowledgeVersion,
  useRebuildKnowledgeIndex,
  useSubmitKnowledgeReview,
} from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';
import { Link } from '@tanstack/react-router';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized.includes('published')
    || normalized.includes('active')
    || normalized.includes('completed')
    || normalized.includes('indexed')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized.includes('review') || normalized.includes('pending')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized.includes('draft') || normalized.includes('idle')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
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

function splitList(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  if (!text) {
    return [];
  }

  return text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function KnowledgeStudioPage() {
  const documentsQuery = useKnowledgeDocuments();
  const createDocumentMutation = useCreateKnowledgeDocument();
  const submitReviewMutation = useSubmitKnowledgeReview();
  const publishVersionMutation = usePublishKnowledgeVersion();
  const rebuildIndexMutation = useRebuildKnowledgeIndex();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);

  const documents = documentsQuery.data ?? [];
  const selectedDocument = useKnowledgeDocument(selectedDocumentId);

  useEffect(() => {
    if (documents.length > 0 && selectedDocumentId === null) {
      setSelectedDocumentId(documents[0].id);
    }
    if (selectedDocumentId !== null && !documents.some((item) => item.id === selectedDocumentId) && documents.length > 0) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await createDocumentMutation.mutateAsync({
      tenant_id: requiredText(formData.get('tenant_id')),
      type: requiredText(formData.get('type')),
      title: requiredText(formData.get('title')),
      category: requiredText(formData.get('category')),
      tags: splitList(formData.get('tags')),
      language: optionalText(formData.get('language')) ?? 'zh-CN',
      channels: splitList(formData.get('channels')),
      content: optionalText(formData.get('content')) ?? null,
    });

    form.reset();
    setSelectedDocumentId(response.id);
    setWorkflowMessage(`已导入文档 #${response.id}，详情面板会自动切换到新文档。`);
  }

  async function handleSubmitReview() {
    if (selectedDocumentId === null) {
      return;
    }
    await submitReviewMutation.mutateAsync(selectedDocumentId);
    setWorkflowMessage('文档已提交审核，等待发布。');
  }

  async function handlePublishVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedDocumentId === null) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const publishVersionRaw = String(formData.get('publish_version') ?? '').trim();
    const publishVersion = Number(publishVersionRaw);
    if (!Number.isFinite(publishVersion) || publishVersion < 1) {
      return;
    }

    await publishVersionMutation.mutateAsync({
      documentId: selectedDocumentId,
      payload: { publish_version: publishVersion },
    });
    setWorkflowMessage(`已发布版本 v${publishVersion}，详情已同步刷新。`);
  }

  async function handleRebuildIndex() {
    if (selectedDocumentId === null) {
      return;
    }
    const document = await rebuildIndexMutation.mutateAsync(selectedDocumentId);
    setWorkflowMessage(`已完成索引重建，共写入 ${document.indexed_chunk_count} 个切片。`);
  }

  if (documentsQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (documentsQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">知识工坊失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 knowledge documents</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {documentsQuery.error instanceof ApiError ? documentsQuery.error.detail : '请求知识列表失败'}
        </p>
      </section>
    );
  }

  const detailDocument =
    selectedDocument.data
    ?? (createDocumentMutation.data && createDocumentMutation.data.id === selectedDocumentId
      ? createDocumentMutation.data
      : null);
  const isDetailLoading = selectedDocument.isLoading && !detailDocument;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Knowledge Studio</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">知识工坊</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              在一个页面里完成知识导入、索引重建、提审和发布，导入与索引结果都直接来自现有 knowledge API 与 worker 任务返回。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/knowledge"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
            >
              返回知识列表
            </Link>
            <Link
              to="/service-ops"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
            >
              服务运营台
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">文档总数</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{documents.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">来自 `/knowledge/documents`</p>
          </article>
          <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">草稿数</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {documents.filter((item) => item.status.toLowerCase().includes('draft')).length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">可提审</p>
          </article>
          <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">在审数</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {documents.filter((item) => item.status.toLowerCase().includes('review')).length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">可发布</p>
          </article>
          <article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">已发布</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {documents.filter((item) => item.status.toLowerCase().includes('published')).length}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">当前可见</p>
          </article>
        </div>
      </div>

      <form
        onSubmit={handleCreateDocument}
        className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950">导入知识文档</h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            POST /knowledge/documents/import
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Tenant ID</span>
            <input
              name="tenant_id"
              required
              placeholder="tenant-001"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">类型</span>
            <input
              name="type"
              required
              placeholder="faq"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">语言</span>
            <input
              name="language"
              defaultValue="zh-CN"
              placeholder="zh-CN"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">标题</span>
            <input
              name="title"
              required
              placeholder="退款常见问题"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">分类</span>
            <input
              name="category"
              required
              placeholder="售后"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">标签</span>
            <input
              name="tags"
              placeholder="退款,常见问题"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">渠道</span>
            <input
              name="channels"
              placeholder="web,h5"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className="mb-2 block text-sm font-medium text-slate-700">正文</span>
            <textarea
              name="content"
              rows={4}
              placeholder="在这里写入完整知识内容，可用于发布前预览。"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={createDocumentMutation.isPending}
          className="mt-4 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {createDocumentMutation.isPending ? '导入中...' : '导入文档'}
        </button>

        {createDocumentMutation.isError ? (
          <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            {createDocumentMutation.error instanceof ApiError
              ? createDocumentMutation.error.detail
              : '导入知识文档失败'}
          </div>
        ) : null}

        {workflowMessage ? (
          <div className="mt-4 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            {workflowMessage}
          </div>
        ) : null}
      </form>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">文档列表</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {documents.length} 条
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {documents.map((document) => {
              const selected = document.id === detailDocument?.id;
              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedDocumentId(document.id)}
                  className={[
                    'block w-full rounded-[1.25rem] border p-4 text-left transition',
                    selected
                      ? 'border-sky-200 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{document.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        #{document.id} · {document.type} · {document.language}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(document.status)}`}>
                      {document.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {document.category}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      v{document.version}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">文档详情与审核</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {detailDocument ? `#${detailDocument.id}` : '未选择'}
            </span>
          </div>

          {isDetailLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-100" />
              <div className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100" />
              <div className="h-20 animate-pulse rounded-[1.35rem] bg-slate-100" />
            </div>
          ) : selectedDocument.isError ? (
            <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              {selectedDocument.error instanceof ApiError
                ? selectedDocument.error.detail
                : '读取知识详情失败'}
            </div>
          ) : detailDocument ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">标题</p>
                  <p className="mt-1 text-base font-medium text-slate-900">{detailDocument.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    类型 {detailDocument.type} · 分类 {detailDocument.category} · 来源 {detailDocument.source_kind}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">状态</p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(detailDocument.status)}`}>
                    {detailDocument.status}
                  </span>
                  <p className="mt-2 text-sm text-slate-500">
                    版本 v{detailDocument.version} · 发布版 {detailDocument.publish_version ?? '暂无'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    已发布于{' '}
                    {detailDocument.published_at ? formatDateTime(detailDocument.published_at) : '尚未发布'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">索引状态</p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(detailDocument.index_status)}`}>
                    {detailDocument.index_status}
                  </span>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">知识切片数</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{detailDocument.indexed_chunk_count}</p>
                  <p className="mt-1 text-sm text-slate-500">{detailDocument.indexed_chunk_count} 个切片</p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">最近索引时间</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detailDocument.last_indexed_at ? formatDateTime(detailDocument.last_indexed_at) : '尚未执行'}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    任务 {detailDocument.last_index_task_id ?? '暂无'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">标签</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detailDocument.tags.length > 0 ? detailDocument.tags.join(' · ') : '无标签'}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">渠道</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detailDocument.channels.length > 0 ? detailDocument.channels.join(' · ') : '无渠道'}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">正文预览</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {detailDocument.content ?? '暂无正文内容'}
                </p>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">索引任务结果</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {detailDocument.last_index_result
                    ? JSON.stringify(detailDocument.last_index_result, null, 2)
                    : '尚未执行 worker 索引任务。'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                  创建于 {formatDateTime(detailDocument.created_at)}
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                  更新于 {formatDateTime(detailDocument.updated_at)}
                </div>
              </div>

              <div className="grid gap-4">
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submitReviewMutation.isPending || detailDocument.status.toLowerCase().includes('review')}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitReviewMutation.isPending ? '提审中...' : '提交审核'}
                </button>

                <button
                  type="button"
                  onClick={handleRebuildIndex}
                  disabled={rebuildIndexMutation.isPending}
                  className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {rebuildIndexMutation.isPending ? '重建中...' : '重建索引'}
                </button>

                <form
                  key={detailDocument.id}
                  onSubmit={handlePublishVersion}
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium text-slate-900">发布版本</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      name="publish_version"
                      type="number"
                      min="1"
                      defaultValue={detailDocument.publish_version ?? detailDocument.version}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="submit"
                      disabled={publishVersionMutation.isPending}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {publishVersionMutation.isPending ? '发布中...' : '发布'}
                    </button>
                  </div>
                </form>
              </div>

              {submitReviewMutation.isError ? (
                <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  {submitReviewMutation.error instanceof ApiError
                    ? submitReviewMutation.error.detail
                    : '提交审核失败'}
                </div>
              ) : null}

              {publishVersionMutation.isError ? (
                <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  {publishVersionMutation.error instanceof ApiError
                    ? publishVersionMutation.error.detail
                    : '发布版本失败'}
                </div>
              ) : null}

              {rebuildIndexMutation.isError ? (
                <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  {rebuildIndexMutation.error instanceof ApiError
                    ? rebuildIndexMutation.error.detail
                    : '重建索引失败'}
                </div>
              ) : null}

              {workflowMessage && createDocumentMutation.data && createDocumentMutation.data.id === detailDocument.id ? (
                <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                  {workflowMessage}
                </div>
              ) : workflowMessage && detailDocument.id === selectedDocumentId ? (
                <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                  {workflowMessage}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              当前没有可查看的知识文档。
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
