import { Link } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';

import { useAuthState } from '@/hooks/use-platform-api';
import { clearStoredAccessToken, platformApiBaseUrl } from '@/lib/platform-api';

const navItems = [
  { to: '/', label: '总览' },
  { to: '/auth', label: '登录' },
  { to: '/service-ops', label: '服务运营' },
  { to: '/users', label: '用户' },
  { to: '/customers', label: '客户' },
  { to: '/channels', label: '渠道' },
  { to: '/conversations', label: '会话' },
  { to: '/knowledge', label: '知识' },
  { to: '/knowledge-studio', label: '知识工坊' },
  { to: '/tickets', label: '工单' },
  { to: '/leave-messages', label: '留言' },
  { to: '/history', label: '历史' },
  { to: '/analytics', label: '分析' },
  { to: '/report-center', label: '报表中心' },
  { to: '/quality-review', label: '质检评分' },
  { to: '/export-management', label: '导出管理' },
  { to: '/video-service', label: '视频客服' },
  { to: '/settings', label: '设置' },
] as const;

export function AppShell({ children }: PropsWithChildren) {
  const authState = useAuthState();

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 px-5 py-4 shadow-[0_18px_70px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-700">Admin Web</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">企业管理后台</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                面向平台运营的浅色工作台，直接连接 `platform-api` 的真实业务数据与配置接口。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  API: {platformApiBaseUrl}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      authState.data?.isAuthenticated ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {authState.data?.isAuthenticated
                    ? `${authState.data.user?.username ?? '已登录'} · ${authState.data.permissions.length} 权限`
                    : '未登录'}
                </div>
                {authState.data?.isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearStoredAccessToken();
                      window.location.reload();
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                  >
                    退出
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    去登录
                  </Link>
                )}
              </div>
              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={item.to === '/' ? { exact: true } : undefined}
                    activeProps={{
                      className: 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm',
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
