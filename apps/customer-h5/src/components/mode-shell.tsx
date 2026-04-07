import type { PropsWithChildren } from 'react';
import { Link } from '@tanstack/react-router';

type ModeShellProps = PropsWithChildren<{
  mode: 'standalone' | 'embedded';
}>;

export function ModeShell({ children, mode }: ModeShellProps) {
  const isEmbedded = mode === 'embedded';

  return (
    <div
      className={[
        'min-h-screen text-slate-950',
        isEmbedded
          ? 'bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)]'
          : 'bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]',
      ].join(' ')}
    >
      <div className={isEmbedded ? 'mx-auto max-w-3xl px-4 py-4' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'}>
        <div
          className={[
            'rounded-[2rem] border bg-white/80 shadow-soft backdrop-blur',
            isEmbedded ? 'border-slate-200 p-4' : 'border-slate-200/80 p-5 sm:p-6',
          ].join(' ')}
        >
          <div
            className={[
              'flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4',
              isEmbedded ? 'flex-col' : 'flex-col sm:flex-row sm:items-center',
            ].join(' ')}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">Customer H5</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {isEmbedded ? '嵌入模式' : '独立模式'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {isEmbedded
                  ? '适合宿主容器、WebView 或小程序容器内承载。'
                  : '适合直接打开、独立浏览和全屏交互。'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white" to="/">
                Home
              </Link>
              <Link
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                to="/leave-message"
              >
                留言页
              </Link>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {isEmbedded ? 'Embedded' : 'Standalone'}
              </span>
            </div>
          </div>

          <div className={isEmbedded ? 'py-4' : 'py-6'}>{children}</div>
        </div>
      </div>
    </div>
  );
}
