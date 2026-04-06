import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import {
  createConversation,
  createCustomerProfile,
  type ConversationRead,
  type CustomerProfileRead,
} from '@/lib/customer-h5-api';
import { platformApiBaseUrl, messageGatewayWsUrl } from '@/lib/runtime-config';
import { useMessageGateway } from '@/hooks/use-message-gateway';

type ChatMode = 'standalone' | 'embedded';

interface ChatWorkspaceProps {
  mode: ChatMode;
}

interface VisitorDraft {
  externalId: string;
  name: string;
  email: string;
  phone: string;
}

function createDefaultVisitorDraft(): VisitorDraft {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`;

  return {
    externalId: `visitor-${suffix}`,
    name: '匿名访客',
    email: '',
    phone: '',
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  switch (status) {
    case 'idle':
      return '待连接';
    case 'connecting':
      return '连接中';
    case 'open':
      return '已连接';
    case 'closed':
      return '已关闭';
    case 'error':
      return '错误';
    default:
      return status;
  }
}

export function ChatWorkspace({ mode }: ChatWorkspaceProps) {
  const compact = mode === 'embedded';
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [profileIdInput, setProfileIdInput] = useState('');
  const [visitorDraft, setVisitorDraft] = useState<VisitorDraft>(() => createDefaultVisitorDraft());
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationRead | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileRead | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const clientId = useMemo(
    () => `customer-h5-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`}`,
    [],
  );

  const gateway = useMessageGateway({
    conversationId: conversation ? String(conversation.id) : null,
    clientId,
    role: 'customer',
  });

  useEffect(() => {
    if (gateway.status === 'open') {
      textareaRef.current?.focus();
    }
  }, [gateway.status]);

  async function handleCreateSession() {
    setCreatingSession(true);
    setSessionError(null);
    setCustomerProfile(null);

    try {
      let profileId = Number(profileIdInput.trim());

      if (!profileIdInput.trim()) {
        const createdProfile = await createCustomerProfile({
          external_id: visitorDraft.externalId.trim(),
          name: visitorDraft.name.trim(),
          email: visitorDraft.email.trim() || null,
          phone: visitorDraft.phone.trim() || null,
          status: 'active',
          tag_ids: [],
        });
        setCustomerProfile(createdProfile);
        profileId = createdProfile.id;
        setProfileIdInput(String(createdProfile.id));
      } else if (Number.isNaN(profileId) || profileId <= 0) {
        throw new Error('customer_profile id 必须是正整数，或者留空让前端自动创建');
      }

      const createdConversation = await createConversation({
        customer_profile_id: profileId,
      });

      setConversation(createdConversation);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '创建会话失败');
    } finally {
      setCreatingSession(false);
    }
  }

  function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();

    const text = draftMessage.trim();
    if (!text || !conversation) {
      return;
    }

    try {
      gateway.sendMessage(text);
      setDraftMessage('');
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '发送消息失败');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  const messages = gateway.messages;
  const conversationState = conversation ? `#${conversation.id} · ${conversation.status}` : '未创建';

  return (
    <div
      className={[
        'grid gap-4',
        compact ? 'xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-[380px_minmax(0,1fr)]',
      ].join(' ')}
    >
      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">访客会话</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {compact ? '嵌入式聊天' : '独立访客聊天'}
              </h2>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              {mode === 'embedded' ? 'Embedded' : 'Standalone'}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            先创建 customer profile，再创建 conversation，随后自动连接 message-gateway websocket。
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Platform API</dt>
              <dd className="mt-1 break-all text-xs font-medium text-slate-800">{platformApiBaseUrl}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Gateway WS</dt>
              <dd className="mt-1 break-all text-xs font-medium text-slate-800">{messageGatewayWsUrl}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Conversation</dt>
              <dd className="mt-1 text-xs font-medium text-slate-800">{conversationState}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">创建会话</h3>
            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-medium',
                gateway.status === 'open'
                  ? 'bg-emerald-100 text-emerald-700'
                  : gateway.status === 'error'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-700',
              ].join(' ')}
            >
              {statusLabel(gateway.status)}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                customer_profile id
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                inputMode="numeric"
                placeholder="留空则自动创建访客资料"
                value={profileIdInput}
                onChange={(event) => setProfileIdInput(event.target.value)}
              />
            </label>

            {!profileIdInput.trim() ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    external id
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    value={visitorDraft.externalId}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, externalId: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    visitor name
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    value={visitorDraft.name}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    email
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    inputMode="email"
                    value={visitorDraft.email}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    phone
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    inputMode="tel"
                    value={visitorDraft.phone}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </label>
              </div>
            ) : (
              <p className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
                已填写 customer_profile id，点击后直接创建 conversation，不会再自动创建 profile。
              </p>
            )}

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingSession}
              onClick={handleCreateSession}
            >
              {creatingSession ? '创建中...' : '创建并连接会话'}
            </button>

            {sessionError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {sessionError}
              </div>
            ) : null}

            {customerProfile ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                自动创建 profile 成功，id: <span className="font-semibold">{customerProfile.id}</span>
              </div>
            ) : null}
          </div>
        </section>
      </aside>

      <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-soft backdrop-blur">
        <header className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Chat</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {conversation ? `会话 #${conversation.id}` : '等待创建会话'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">client {clientId}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                socket {statusLabel(gateway.status)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                messages {messages.length}
              </span>
            </div>
          </div>

          {gateway.ack ? (
            <p className="mt-3 text-sm text-slate-600">
              已连接到 conversation {gateway.ack.conversation_id}，client {gateway.ack.client_id}
              ，role {gateway.ack.role}。
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              创建会话后会自动连接 websocket。当前页面仅依赖平台 API 与 message-gateway。
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map((message) => {
                const isCustomer = message.senderRole === 'customer';
                return (
                  <article
                    key={message.id}
                    className={['flex', isCustomer ? 'justify-end' : 'justify-start'].join(' ')}
                  >
                    <div
                      className={[
                        'max-w-[82%] rounded-3xl px-4 py-3 shadow-sm',
                        isCustomer ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-70">
                        <span>{isCustomer ? 'customer' : message.senderRole}</span>
                        <span>·</span>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
              <div className="max-w-md">
                <p className="text-sm font-medium text-slate-900">聊天区已就绪</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  创建会话后，输入消息并回车发送。收到的消息会实时出现在这里。
                </p>
              </div>
            </div>
          )}
        </div>

        <form className="border-t border-slate-200/80 p-4 sm:p-5" onSubmit={handleSendMessage}>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <label className="sr-only" htmlFor="customer-message">
              message
            </label>
            <textarea
              ref={textareaRef}
              id="customer-message"
              className="min-h-[108px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
              disabled={!conversation}
              placeholder={conversation ? '输入消息，回车发送，Shift+Enter 换行' : '先创建会话再输入消息'}
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                输入框已接入真实发送链路，当前仅处理文本消息。
              </p>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!conversation || !draftMessage.trim()}
                type="submit"
              >
                发送消息
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
