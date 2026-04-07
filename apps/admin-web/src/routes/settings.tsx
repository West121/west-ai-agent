import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';

import { useChannelApps, useGenerateH5Link } from '@/hooks/use-platform-api';
import { ApiError } from '@/lib/platform-api';

function ChannelBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {isActive ? 'active' : 'inactive'}
    </span>
  );
}

export function SettingsPage() {
  const [channelAppId, setChannelAppId] = useState<number | ''>('');
  const [path, setPath] = useState('/');
  const [copied, setCopied] = useState(false);
  const channelQuery = useChannelApps();
  const h5LinkMutation = useGenerateH5Link();

  useEffect(() => {
    if (channelQuery.data?.items.length && channelAppId === '') {
      setChannelAppId(channelQuery.data.items[0].id);
    }
    if (channelQuery.data?.items.length && channelAppId !== '') {
      const exists = channelQuery.data.items.some((item) => item.id === channelAppId);
      if (!exists) {
        setChannelAppId(channelQuery.data.items[0].id);
      }
    }
  }, [channelAppId, channelQuery.data?.items]);

  const selectedChannel =
    channelQuery.data?.items.find((item) => item.id === channelAppId) ?? channelQuery.data?.items[0] ?? null;
  const generatedLink = h5LinkMutation.data?.h5_url ?? '';

  async function handleCopy() {
    if (!generatedLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChannel) {
      return;
    }
    await h5LinkMutation.mutateAsync({
      channelAppId: selectedChannel.id,
      path: path.trim() || '/',
    });
  }

  if (channelQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-72 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (channelQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">渠道配置失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 channels 列表</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {channelQuery.error instanceof ApiError ? channelQuery.error.detail : '请求渠道列表失败'}
        </p>
      </section>
    );
  }

  const channels = channelQuery.data?.items ?? [];

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Settings</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">渠道和 H5 链接</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              当前页直接读取 `GET /channels/apps`，并通过 `POST /channels/apps/{'{id}'}/h5-link` 生成 H5 链接。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            渠道数：{channels.length}
            <div className="mt-1 text-xs text-slate-500">
              {channels.filter((item) => item.is_active).length} 个 active
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr_1.05fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">渠道摘要</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              平台接口
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">渠道总数</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{channels.length}</p>
              </article>
              <article className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">活跃渠道</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {channels.filter((item) => item.is_active).length}
                </p>
              </article>
            </div>
            {channels.length > 0 ? (
              channels.map((channel) => (
                <article key={channel.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{channel.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{channel.code}</p>
                    </div>
                    <ChannelBadge isActive={channel.is_active} />
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p className="break-all">Base URL: {channel.base_url}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有渠道配置。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">操作面板</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">ops</span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">常用路径</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  /chat
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  /service
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  /history
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  /knowledge
                </span>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">推荐入口</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to="/channels"
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  渠道管理
                </Link>
                <Link
                  to="/service-ops"
                  className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
                >
                  服务运营
                </Link>
                <Link
                  to="/analytics"
                  className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
                >
                  分析看板
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">H5 链接生成表单</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              可直接调用
            </span>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">选择渠道</span>
              <select
                value={channelAppId}
                onChange={(event) => setChannelAppId(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} · {channel.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">页面路径</span>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/pages/order-detail?id=1001"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <button
              type="submit"
              disabled={h5LinkMutation.isPending || !selectedChannel}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {h5LinkMutation.isPending ? '生成中...' : '生成 H5 链接'}
            </button>
          </form>

          {h5LinkMutation.isError ? (
            <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {h5LinkMutation.error instanceof ApiError
                ? h5LinkMutation.error.detail
                : '生成 H5 链接失败'}
            </div>
          ) : null}

          {h5LinkMutation.data ? (
            <div className="mt-5 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">生成结果</p>
              <p className="mt-2 break-all text-sm text-emerald-800">{generatedLink}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm"
                >
                  打开链接
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-full bg-white px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm"
                >
                  {copied ? '已复制' : '复制链接'}
                </button>
              </div>
            </div>
          ) : null}

          {selectedChannel ? (
            <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">当前渠道</p>
              <p className="mt-2">名称：{selectedChannel.name}</p>
              <p className="mt-1">基址：{selectedChannel.base_url}</p>
              <p className="mt-1">状态：{selectedChannel.is_active ? 'active' : 'inactive'}</p>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
