import { useMemo, useState } from 'react';

import { useChannelApps, useGenerateH5Link } from '@/hooks/use-platform-api';
import { ApiError } from '@/lib/platform-api';

export function ChannelsPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [path, setPath] = useState('/chat');
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const channelsQuery = useChannelApps();
  const generateH5Link = useGenerateH5Link();

  const channels = channelsQuery.data?.items ?? [];
  const selectedChannel =
    channels.find((item) => item.id === selectedChannelId) ?? channels[0] ?? null;

  const activeCount = useMemo(
    () => channels.filter((item) => item.is_active).length,
    [channels],
  );

  if (channelsQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="h-72 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-72 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (channelsQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">渠道失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取渠道配置</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {channelsQuery.error instanceof ApiError ? channelsQuery.error.detail : '请求渠道列表失败'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Channels</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">渠道管理</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接连接 `GET /channels/apps` 与 H5 链接生成接口，查看接入渠道、活跃状态和嵌入地址。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            渠道数：{channels.length}
            <div className="mt-1 text-xs text-slate-500">活跃渠道：{activeCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">渠道目录</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {channels.length} 个渠道
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {channels.length > 0 ? (
              channels.map((channel) => {
                const selected = channel.id === (selectedChannel?.id ?? null);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={[
                      'block w-full rounded-[1.25rem] border p-4 text-left transition',
                      selected
                        ? 'border-sky-200 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{channel.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{channel.code}</p>
                      </div>
                      <span
                        className={[
                          'rounded-full px-3 py-1 text-xs font-medium',
                          channel.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        ].join(' ')}
                      >
                        {channel.is_active ? 'active' : 'inactive'}
                      </span>
                    </div>
                    <p className="mt-3 break-all text-sm leading-6 text-slate-600">{channel.base_url}</p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有渠道配置。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">H5 接入</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {selectedChannel ? '可生成' : '未选择'}
            </span>
          </div>

          {selectedChannel ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{selectedChannel.name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedChannel.code}</p>
                <p className="mt-3 break-all text-sm leading-6 text-slate-600">
                  {selectedChannel.base_url}
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">嵌入路径</span>
                <input
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="/chat?source=app"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <button
                type="button"
                disabled={generateH5Link.isPending}
                onClick={() =>
                  generateH5Link.mutate(
                    {
                      channelAppId: selectedChannel.id,
                      path: path.trim() || '/',
                    },
                    {
                      onSuccess: () => {
                        setInteractionMessage(null);
                      },
                    },
                  )
                }
                className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {generateH5Link.isPending ? '生成中...' : '生成 H5 链接'}
              </button>

              {generateH5Link.isError ? (
                <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  {generateH5Link.error instanceof ApiError
                    ? generateH5Link.error.detail
                    : '生成 H5 链接失败'}
                </div>
              ) : null}

              {generateH5Link.data ? (
                <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900">最新链接</p>
                  <p className="mt-2 break-all text-sm leading-6 text-emerald-800">
                    {generateH5Link.data.h5_url}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(generateH5Link.data.h5_url);
                        setInteractionMessage('链接已复制到剪贴板。');
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      复制链接
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(generateH5Link.data.h5_url, '_blank', 'noopener,noreferrer');
                        setInteractionMessage('已打开新窗口进行验证。');
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      打开验证
                    </button>
                  </div>
                  {interactionMessage ? (
                    <p className="mt-3 text-sm leading-6 text-emerald-900">{interactionMessage}</p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  选择一个渠道并生成 H5 链接，支持官网、App WebView 和外部嵌入接入。
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              暂无渠道可供配置。
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
