import { useState } from 'react';

import { useAuthUsers } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

function StatusBadge({ isActive }: { isActive?: boolean }) {
  const label = isActive === false ? 'inactive' : isActive === true ? 'active' : 'unknown';
  const className =
    isActive === false
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : isActive === true
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-slate-200 bg-slate-50 text-slate-600';

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function UserCard({
  user,
}: {
  user: {
    id: number;
    username: string;
    role: { name: string } | null;
    is_active?: boolean;
    created_at?: string;
  };
}) {
  return (
    <article className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{user.username}</p>
          <p className="mt-1 text-sm text-slate-500">{user.role?.name ?? '未分配角色'}</p>
        </div>
        <StatusBadge isActive={user.is_active} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">用户 ID</dt>
          <dd className="mt-1 font-medium text-slate-900">#{user.id}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">创建时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDateTime(user.created_at)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function UsersPage() {
  const [keyword, setKeyword] = useState('');
  const query = useAuthUsers();

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[1.35rem] bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">用户列表不可用</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">auth 用户列表接口暂时没有返回数据</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError && query.error.status === 404
            ? '请补充 GET /auth/users 接口后再刷新页面。当前页面已经按该接口的返回结构接好了查询与展示。'
            : query.error instanceof Error
              ? query.error.message
              : '请求失败'}
        </p>
      </section>
    );
  }

  const users = query.data ?? [];
  const filteredUsers = users.filter((user) => {
    const statusText = user.is_active === true ? 'active' : user.is_active === false ? 'inactive' : 'unknown';
    const haystack = [
      user.username,
      user.role?.name ?? '',
      user.role?.permissions.map((permission) => permission.name).join(' ') ?? '',
      statusText,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword.trim().toLowerCase());
  });

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Users</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">用户管理</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              当前页面直接调用 `GET /auth/users`，支持表格和卡片两种展示，方便后续接入搜索、权限和用户状态管理。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            共 {users.length} 位用户
            <div className="mt-1 text-xs text-slate-500">接口结果：{filteredUsers.length} 条匹配</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex-1">
            <span className="sr-only">搜索用户</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索用户名、角色、权限或状态"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            接口：`/auth/users`
          </div>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)] md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              <th className="px-5 py-4">用户名</th>
              <th className="px-5 py-4">角色</th>
              <th className="px-5 py-4">权限数</th>
              <th className="px-5 py-4">状态</th>
              <th className="px-5 py-4">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id} className="text-sm">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-950">{user.username}</div>
                    <div className="mt-1 text-xs text-slate-500">ID #{user.id}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.role?.name ?? '未分配'}</td>
                  <td className="px-5 py-4 text-slate-600">{user.role?.permissions.length ?? 0}</td>
                  <td className="px-5 py-4">
                    <StatusBadge isActive={user.is_active} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(user.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                  没有匹配的用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => <UserCard key={user.id} user={user} />)
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            没有匹配的用户
          </div>
        )}
      </div>
    </section>
  );
}
