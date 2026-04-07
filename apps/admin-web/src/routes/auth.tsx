import { useState, type FormEvent } from 'react';

import { clearStoredAccessToken, ApiError } from '@/lib/platform-api';
import { formatDateTime } from '@/lib/format';
import { useAuthState, useSignIn } from '@/hooks/use-platform-api';

export function AuthPage() {
  const authState = useAuthState();
  const signInMutation = useSignIn();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await signInMutation.mutateAsync({
      username: username.trim(),
      password,
    });

    window.location.assign('/');
  }

  function handleSignOut() {
    clearStoredAccessToken();
    window.location.reload();
  }

  const currentUser = authState.data?.user ?? null;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Auth Entry</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">登录与鉴权入口</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          直接调用 `POST /auth/login` 写入本地 token，并通过 `GET /auth/me/permissions` 校验当前权限。
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="admin"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <button
            type="submit"
            disabled={signInMutation.isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {signInMutation.isPending ? '登录中...' : '登录'}
          </button>
        </form>

        {signInMutation.isError ? (
          <div className="mt-4 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            {signInMutation.error instanceof ApiError ? signInMutation.error.detail : '登录失败'}
          </div>
        ) : null}

        {signInMutation.data ? (
          <div className="mt-4 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            已保存 token，页面将刷新到首页。
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">当前会话</h3>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                authState.data?.isAuthenticated
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {authState.data?.isAuthenticated ? '已登录' : '未登录'}
            </span>
          </div>

          {currentUser ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.25rem] bg-slate-50 p-4">
                <p className="text-sm text-slate-500">用户</p>
                <p className="mt-1 text-base font-medium text-slate-900">{currentUser.username}</p>
                <p className="mt-1 text-sm text-slate-500">
                  角色：{currentUser.role?.name ?? '未分配'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">权限数</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {authState.data?.permissions.length ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">用户 ID</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">#{currentUser.id}</p>
                </div>
              </div>

              <div className="rounded-[1.25rem] bg-slate-50 p-4">
                <p className="text-sm text-slate-500">权限列表</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {authState.data?.permissions.length ? (
                    authState.data.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                      >
                        {permission}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">暂无权限数据</span>
                  )}
                </div>
              </div>

              {currentUser.created_at ? (
                <div className="rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600">
                  创建时间：{formatDateTime(currentUser.created_at)}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
              >
                退出登录
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              当前没有 token。输入平台账号密码后会写入本地存储，并刷新整个后台壳。
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
