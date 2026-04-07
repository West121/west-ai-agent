import { useMemo, useState } from 'react';

import { useCustomers } from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';

type ViewMode = 'table' | 'card';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('active') || normalized.includes('enabled') || normalized.includes('open')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (normalized.includes('pending') || normalized.includes('review')) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (normalized.includes('blocked') || normalized.includes('closed') || normalized.includes('disabled')) {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function CustomerCard({
  customer,
}: {
  customer: {
    id: number;
    external_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    tags: { id: number; name: string }[];
  };
}) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-950">{customer.name}</p>
          <p className="mt-1 text-sm text-slate-500">外部 ID · {customer.external_id}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(customer.status)}`}>
          {customer.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {customer.tags.length > 0 ? (
          customer.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
            >
              {tag.name}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            无标签
          </span>
        )}
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">邮箱</dt>
          <dd className="mt-1 font-medium text-slate-900">{customer.email ?? '暂无'}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">手机号</dt>
          <dd className="mt-1 font-medium text-slate-900">{customer.phone ?? '暂无'}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">创建时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDateTime(customer.created_at)}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">更新时间</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDateTime(customer.updated_at)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function CustomersPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const query = useCustomers();

  const customers = query.data ?? [];

  const statusOptions = useMemo(
    () => [...new Set(customers.map((item) => item.status).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN')),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const haystack = [
        customer.name,
        customer.external_id,
        customer.email ?? '',
        customer.phone ?? '',
        customer.status,
        customer.tags.map((tag) => tag.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedKeyword);
    });
  }, [customers, keyword, statusFilter]);

  const summaryCards = [
    { label: '客户总数', value: customers.length.toString(), hint: '直接来自 /customer/profiles' },
    { label: '当前匹配', value: filteredCustomers.length.toString(), hint: '按搜索和状态本地筛选' },
    { label: '含标签', value: customers.filter((item) => item.tags.length > 0).length.toString(), hint: '可用于客群管理' },
    {
      label: '状态数',
      value: statusOptions.length.toString(),
      hint: '当前接口返回的状态类型',
    },
  ];

  if (query.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[1.35rem] bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">客户中心不可用</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取 customer profiles</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {query.error instanceof ApiError ? query.error.detail : '请求客户列表失败'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Customers</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">客户中心</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接调用 `GET /customer/profiles`，支持列表与卡片两种展示，并按状态、标签和关键词筛选客户。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            客户数：{customers.length}
            <div className="mt-1 text-xs text-slate-500">当前匹配：{filteredCustomers.length}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article key={card.label} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{card.hint}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">搜索客户</span>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索姓名、外部 ID、邮箱、手机号或标签"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">全部状态</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">视图</span>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'table'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800'
                }`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'card'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800'
                }`}
              >
                卡片
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                <th className="px-5 py-4">客户</th>
                <th className="px-5 py-4">联系方式</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4">标签</th>
                <th className="px-5 py-4">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="text-sm">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-950">{customer.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        外部 ID · {customer.external_id} · 创建 {formatDateTime(customer.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{customer.email ?? '暂无邮箱'}</div>
                      <div className="mt-1 text-xs text-slate-500">{customer.phone ?? '暂无手机号'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {customer.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {customer.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '无标签'
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDateTime(customer.updated_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    没有匹配的客户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} />)
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              没有匹配的客户
            </div>
          )}
        </div>
      )}
    </section>
  );
}
