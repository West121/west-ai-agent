import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { messageGatewayWsUrl, platformApiBaseUrl } from '@/lib/runtime-config';

const entryPoints = [
  {
    to: '/standalone',
    title: '进入独立模式',
    description: '完整访客聊天页，适合直连打开和分享。',
  },
  {
    to: '/embedded',
    title: '进入嵌入模式',
    description: '更紧凑的聊天壳，适合宿主页面、WebView 或 iframe。',
  },
  {
    to: '/leave-message',
    title: '进入留言页',
    description: '适合人工不在线时留下联系信息和问题内容。',
  },
] as const;

export function HomePage() {
  const { data } = useQuery({
    queryKey: ['customer-h5', 'boot'],
    queryFn: async () => ({
      status: 'ready',
      timestamp: new Date().toISOString(),
    }),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid w-full gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-soft backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">
              Customer H5 Entry
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              真实访客聊天前端入口
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              这个页面现在直接通往 standalone 和 embedded 两种聊天模式，两者都能创建
              customer profile、创建 conversation，并通过 message-gateway
              websocket 收发文本消息。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {entryPoints.map((item, index) => (
                <Link
                  key={item.to}
                  className={[
                    'inline-flex rounded-2xl px-4 py-3 text-sm font-medium transition',
                    index === 0
                      ? 'bg-slate-950 text-white hover:bg-slate-800'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50',
                  ].join(' ')}
                  to={item.to}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-slate-50 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
              Runtime
            </p>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-slate-400">Platform API</p>
                <p className="mt-1 break-all font-medium">{platformApiBaseUrl}</p>
              </div>
              <div>
                <p className="text-slate-400">Message Gateway WS</p>
                <p className="mt-1 break-all font-medium">{messageGatewayWsUrl}</p>
              </div>
              <div>
                <p className="text-slate-400">Boot</p>
                <p className="mt-1 font-medium">{data?.timestamp ?? 'pending'}</p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <p className="mt-1 font-medium">{data?.status ?? 'loading'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Standalone</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              独立展示全量聊天壳，适合用户直接打开、分享链接和完整页面承载。
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Embedded</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              更紧凑的容器内布局，适合 H5 宿主页面、WebView 或第三方壳嵌入。
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Flow</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              创建 customer profile &rarr; 创建 conversation &rarr; 连接 websocket &rarr; 发送消息。
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
