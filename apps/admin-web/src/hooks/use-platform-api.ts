import { useMutation, useQuery } from '@tanstack/react-query';

import {
  type AuthUser,
  type CurrentPermissions,
  type AnalyticsBreakdown,
  type ChannelApp,
  type ChannelAppListResponse,
  type ConversationAnalyticsOverview,
  type ConversationHistoryItem,
  type ConversationHistoryListResponse,
  type ConversationSummaryResponse,
  type Conversation,
  type ConversationEndInput,
  type ConversationTransferInput,
  type CustomerProfile,
  type ExportTask,
  type ExportTaskCreateInput,
  type KnowledgeDocument,
  type KnowledgeDocumentCreateInput,
  type KnowledgeIndexTaskResult,
  type LeaveMessage,
  type LeaveMessageCreateInput,
  type LeaveMessageUpdateInput,
  type LeaveMessageListResponse,
  type H5LinkResponse,
  type LoginInput,
  type LoginResponse,
  type PublishKnowledgeVersionInput,
  type SatisfactionCreateInput,
  type SatisfactionRecord,
  type ServiceAnalyticsOverview,
  type VideoRecording,
  type VideoRecordingListResponse,
  type VideoRecordingRetentionInput,
  type VideoSession,
  type VideoSessionSummaryInput,
  type VideoSessionEndInput,
  type VideoSessionListResponse,
  type VideoSessionStartInput,
  type VideoSessionTransferTicketInput,
  type VideoSnapshot,
  type VideoSnapshotCreateInput,
  type VideoSnapshotListResponse,
  type Ticket,
  type TicketCreateInput,
  type TicketListResponse,
  type TicketUpdateInput,
  ApiError,
  clearStoredAccessToken,
  getStoredAccessToken,
  normalizeAuthUsers,
  requestJson,
  setStoredAccessToken,
} from '@/lib/platform-api';
import { queryClient } from '@/lib/query-client';

export type DashboardSummary = {
  customerCount: number;
  knowledgeCount: number;
  channelCount: number;
  conversationCount: number;
  activeChannelCount: number;
  draftKnowledgeCount: number;
  publishedKnowledgeCount: number;
  openConversationCount: number;
  topChannels: ChannelApp[];
  topKnowledgeDocuments: KnowledgeDocument[];
  topCustomers: CustomerProfile[];
  topConversations: Conversation[];
  lastRefreshedAt: string;
};

export type AnalyticsSummary = {
  historyCount: number;
  summaryCount: number;
  totalMessages: number;
  averageSatisfaction: number | null;
  statusBreakdown: { label: string; value: number }[];
  channelBreakdown: { label: string; value: number }[];
  recentItems: Array<{
    id: number;
    customer_profile_id: number;
    channel: string | null;
    status: string;
    last_message_at: string | null;
    message_count: number;
    satisfaction_score: number | null;
    ai_summary: string | null;
  }>;
  lastRefreshedAt: string;
  conversationAnalytics: ConversationAnalyticsOverview;
  serviceAnalytics: ServiceAnalyticsOverview;
  transferTrend: { label: string; value: number }[];
  ticketPriorityBreakdown: AnalyticsBreakdown[];
  leaveSourceBreakdown: AnalyticsBreakdown[];
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['platform-api', 'dashboard-summary'],
    queryFn: async (): Promise<DashboardSummary> => {
      const [customers, knowledge, channels, conversations] = await Promise.all([
        requestJson<CustomerProfile[]>('/customer/profiles'),
        requestJson<KnowledgeDocument[]>('/knowledge/documents'),
        requestJson<ChannelAppListResponse>('/channels/apps'),
        requestJson<Conversation[]>('/conversation/conversations'),
      ]);

      const topChannels = channels.items.slice(0, 4);
      const topKnowledgeDocuments = knowledge.slice(0, 4);
      const topCustomers = customers.slice(0, 4);
      const topConversations = conversations.slice(0, 4);

      return {
        customerCount: customers.length,
        knowledgeCount: knowledge.length,
        channelCount: channels.items.length,
        conversationCount: conversations.length,
        activeChannelCount: channels.items.filter((item) => item.is_active).length,
        draftKnowledgeCount: knowledge.filter((item) => item.status === 'draft').length,
        publishedKnowledgeCount: knowledge.filter((item) => item.status === 'published').length,
        openConversationCount: conversations.filter((item) => item.status !== 'ended').length,
        topChannels,
        topKnowledgeDocuments,
        topCustomers,
        topConversations,
        lastRefreshedAt: new Date().toISOString(),
      };
    },
  });
}

export function useAuthUsers() {
  return useQuery({
    queryKey: ['platform-api', 'auth-users'],
    queryFn: async (): Promise<AuthUser[]> => {
      const payload = await requestJson<unknown>('/auth/users');
      return normalizeAuthUsers(payload);
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ['platform-api', 'customers'],
    queryFn: () => requestJson<CustomerProfile[]>('/customer/profiles'),
  });
}

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: ['platform-api', 'knowledge-documents'],
    queryFn: () => requestJson<KnowledgeDocument[]>('/knowledge/documents'),
  });
}

export function useKnowledgeDocument(documentId: number | null) {
  return useQuery({
    queryKey: ['platform-api', 'knowledge-document', documentId],
    enabled: typeof documentId === 'number',
    queryFn: () => requestJson<KnowledgeDocument>(`/knowledge/documents/${documentId}`),
  });
}

export function useChannelApps() {
  return useQuery({
    queryKey: ['platform-api', 'channel-apps'],
    queryFn: () => requestJson<ChannelAppListResponse>('/channels/apps'),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ['platform-api', 'conversations'],
    queryFn: () => requestJson<Conversation[]>('/conversation/conversations'),
  });
}

export function useVideoSessions() {
  return useQuery({
    queryKey: ['platform-api', 'video', 'sessions'],
    queryFn: async (): Promise<VideoSession[]> => {
      const payload = await requestJson<VideoSessionListResponse>('/video/sessions');
      return payload.items ?? [];
    },
  });
}

export function useCurrentVideoSession() {
  return useQuery({
    queryKey: ['platform-api', 'video', 'current'],
    queryFn: () => requestJson<VideoSession | null>('/video/sessions/current'),
  });
}

export function useVideoSnapshots(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: ['platform-api', 'video', 'snapshots', sessionId],
    enabled: typeof sessionId === 'number',
    queryFn: async (): Promise<VideoSnapshot[]> => {
      const payload = await requestJson<VideoSnapshotListResponse>(`/video/sessions/${sessionId}/snapshots`);
      return payload.items ?? [];
    },
  });
}

export function useVideoRecordings(sessionId: number | null | undefined, retentionState?: 'retained' | 'deleted' | 'all', keyword?: string) {
  return useQuery({
    queryKey: ['platform-api', 'video', 'recordings', sessionId, retentionState ?? 'retained', keyword ?? ''],
    enabled: typeof sessionId === 'number',
    queryFn: async (): Promise<VideoRecording[]> => {
      const searchParams = new URLSearchParams();
      if (retentionState && retentionState !== 'all') {
        searchParams.set('retention_state', retentionState);
      }
      if (keyword?.trim()) {
        searchParams.set('keyword', keyword.trim());
      }
      const path = `/video/sessions/${sessionId}/recordings${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const payload = await requestJson<VideoRecordingListResponse>(path);
      return payload.items ?? [];
    },
  });
}

export function useVideoSessionSummary(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: ['platform-api', 'video', 'summary', sessionId],
    enabled: typeof sessionId === 'number',
    queryFn: () => requestJson<VideoSession>(`/video/sessions/${sessionId}/summary`),
  });
}

export function useStartVideoSession() {
  return useMutation({
    mutationFn: (payload: VideoSessionStartInput) =>
      requestJson<VideoSession>('/video/sessions/start', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useEndVideoSession() {
  return useMutation({
    mutationFn: (variables: { sessionId: number; payload: VideoSessionEndInput }) =>
      requestJson<VideoSession>(`/video/sessions/${variables.sessionId}/end`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useCreateVideoSnapshot() {
  return useMutation({
    mutationFn: (variables: { sessionId: number; payload: VideoSnapshotCreateInput }) =>
      requestJson<VideoSnapshot>(`/video/sessions/${variables.sessionId}/snapshots`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useTransferVideoSessionTicket() {
  return useMutation({
    mutationFn: (variables: { sessionId: number; payload: VideoSessionTransferTicketInput }) =>
      requestJson<Ticket>(`/video/sessions/${variables.sessionId}/transfer-ticket`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useUploadVideoRecording() {
  return useMutation({
    mutationFn: (variables: {
      sessionId: number;
      file: File;
      label?: string | null;
      note?: string | null;
      durationSeconds?: number | null;
    }) => {
      const formData = new FormData();
      formData.append('file', variables.file);
      if (variables.label) formData.append('label', variables.label);
      if (variables.note) formData.append('note', variables.note);
      if (variables.durationSeconds !== undefined && variables.durationSeconds !== null) {
        formData.append('duration_seconds', String(variables.durationSeconds));
      }
      return requestJson<VideoRecording>(`/video/sessions/${variables.sessionId}/recordings/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useUpdateVideoRecordingRetention() {
  return useMutation({
    mutationFn: (variables: { recordingId: number; payload: VideoRecordingRetentionInput }) =>
      requestJson<VideoRecording>(`/video/recordings/${variables.recordingId}/retention`, {
        method: 'PATCH',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useUpsertVideoSessionSummary() {
  return useMutation({
    mutationFn: (variables: { sessionId: number; payload: VideoSessionSummaryInput }) =>
      requestJson<VideoSession>(`/video/sessions/${variables.sessionId}/summary`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useGenerateH5Link() {
  return useMutation({
    mutationFn: async (variables: { channelAppId: number; path: string }) =>
      requestJson<H5LinkResponse>(`/channels/apps/${variables.channelAppId}/h5-link`, {
        method: 'POST',
        body: { path: variables.path },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useTickets() {
  return useQuery({
    queryKey: ['platform-api', 'tickets'],
    queryFn: async (): Promise<Ticket[]> => {
      const payload = await requestJson<TicketListResponse>('/service/tickets');
      return payload.items ?? [];
    },
  });
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: (payload: TicketCreateInput) =>
      requestJson<Ticket>('/service/tickets', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useUpdateTicket() {
  return useMutation({
    mutationFn: (variables: { ticketId: number; payload: TicketUpdateInput }) =>
      requestJson<Ticket>(`/service/tickets/${variables.ticketId}`, {
        method: 'PATCH',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useLeaveMessages() {
  return useQuery({
    queryKey: ['platform-api', 'leave-messages'],
    queryFn: async (): Promise<LeaveMessage[]> => {
      const payload = await requestJson<LeaveMessageListResponse>('/service/leave-messages');
      return payload.items ?? [];
    },
  });
}

export function useCreateLeaveMessage() {
  return useMutation({
    mutationFn: (payload: LeaveMessageCreateInput) =>
      requestJson<LeaveMessage>('/service/leave-messages', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useUpdateLeaveMessage() {
  return useMutation({
    mutationFn: (variables: { leaveMessageId: number; payload: LeaveMessageUpdateInput }) =>
      requestJson<LeaveMessage>(`/service/leave-messages/${variables.leaveMessageId}`, {
        method: 'PATCH',
        body: variables.payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useConversationHistory() {
  return useQuery({
    queryKey: ['platform-api', 'conversation-history'],
    queryFn: async (): Promise<ConversationHistoryItem[]> => {
      const payload = await requestJson<ConversationHistoryListResponse>('/conversation/conversations/history');
      return payload.items ?? [];
    },
  });
}

export function useExportTasks() {
  return useQuery({
    queryKey: ['platform-api', 'export-tasks'],
    queryFn: () => requestJson<ExportTask[]>('/exporting/tasks'),
  });
}

export function useExportTask(taskId: number | null) {
  return useQuery({
    queryKey: ['platform-api', 'export-task', taskId],
    enabled: typeof taskId === 'number',
    queryFn: () => requestJson<ExportTask>(`/exporting/tasks/${taskId}`),
  });
}

export function useCreateExportTask() {
  return useMutation({
    mutationFn: (payload: ExportTaskCreateInput) =>
      requestJson<ExportTask>('/exporting/tasks', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useExecuteExportTask() {
  return useMutation({
    mutationFn: (taskId: number) =>
      requestJson<ExportTask>(`/exporting/tasks/${taskId}/execute`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useCompleteExportTask() {
  return useMutation({
    mutationFn: (taskId: number) =>
      requestJson<ExportTask>(`/exporting/tasks/${taskId}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useConversationSummary(conversationId: number | null | undefined) {
  return useQuery({
    queryKey: ['platform-api', 'conversation-summary', conversationId],
    enabled: typeof conversationId === 'number',
    queryFn: () =>
      requestJson<ConversationSummaryResponse>(`/conversation/conversations/${conversationId}/summary`),
  });
}

export function useConversationSatisfaction(conversationId: number | null | undefined) {
  return useQuery({
    queryKey: ['platform-api', 'conversation-satisfaction', conversationId],
    enabled: typeof conversationId === 'number',
    queryFn: () =>
      requestJson<SatisfactionRecord | null>(`/conversation/conversations/${conversationId}/satisfaction`),
  });
}

export function useTransferConversation() {
  return useMutation({
    mutationFn: (variables: { conversationId: number; payload: ConversationTransferInput }) =>
      requestJson<Conversation>(`/conversation/conversations/${variables.conversationId}/transfer`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'conversation-history'] });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-summary', variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-satisfaction', variables.conversationId],
      });
    },
  });
}

export function useEndConversation() {
  return useMutation({
    mutationFn: (variables: { conversationId: number; payload: ConversationEndInput }) =>
      requestJson<Conversation>(`/conversation/conversations/${variables.conversationId}/end`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'conversation-history'] });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-summary', variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-satisfaction', variables.conversationId],
      });
    },
  });
}

export function useSubmitConversationSatisfaction() {
  return useMutation({
    mutationFn: (variables: { conversationId: number; payload: SatisfactionCreateInput }) =>
      requestJson<SatisfactionRecord>(`/conversation/conversations/${variables.conversationId}/satisfaction`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-summary', variables.conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'conversation-satisfaction', variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'conversation-history'] });
    },
  });
}

export function useCreateKnowledgeDocument() {
  return useMutation({
    mutationFn: (payload: KnowledgeDocumentCreateInput) =>
      requestJson<KnowledgeDocument>('/knowledge/documents/import', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}

export function useSubmitKnowledgeReview() {
  return useMutation({
    mutationFn: (documentId: number) =>
      requestJson<KnowledgeDocument>(`/knowledge/documents/${documentId}/submit-review`, {
        method: 'POST',
      }),
    onSuccess: (_data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'knowledge-document', documentId] });
    },
  });
}

export function usePublishKnowledgeVersion() {
  return useMutation({
    mutationFn: (variables: { documentId: number; payload: PublishKnowledgeVersionInput }) =>
      requestJson<KnowledgeDocument>(`/knowledge/documents/${variables.documentId}/publish-version`, {
        method: 'POST',
        body: variables.payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
      queryClient.invalidateQueries({
        queryKey: ['platform-api', 'knowledge-document', variables.documentId],
      });
    },
  });
}

export function useRebuildKnowledgeIndex() {
  return useMutation({
    mutationFn: (documentId: number) =>
      requestJson<KnowledgeIndexTaskResult>(`/knowledge/documents/${documentId}/rebuild-index`, {
        method: 'POST',
      }),
    onSuccess: (_data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'knowledge-document', documentId] });
    },
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['platform-api', 'analytics'],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const [history, conversationAnalytics, serviceAnalytics] = await Promise.all([
        requestJson<ConversationHistoryListResponse>('/conversation/conversations/history'),
        requestJson<ConversationAnalyticsOverview>('/conversation/analytics/overview'),
        requestJson<ServiceAnalyticsOverview>('/service/analytics/overview'),
      ]);
      const recentHistory = [...(history.items ?? [])].sort((left, right) => {
        const leftTime = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
        const rightTime = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
        return rightTime - leftTime;
      });

      const summaries = await Promise.all(
        recentHistory.slice(0, 8).map(async (item) => {
          try {
            return await requestJson<ConversationSummaryResponse>(`/conversation/conversations/${item.id}/summary`);
          } catch {
            return null;
          }
        }),
      );

      const summaryMap = new Map(
        summaries
          .filter((item): item is ConversationSummaryResponse => item !== null)
          .map((item) => [item.conversation_id, item]),
      );

      const statusCounts = new Map<string, number>();
      const channelCounts = new Map<string, number>();
      let totalMessages = 0;
      let totalSatisfaction = 0;
      let satisfactionSamples = 0;

      recentHistory.forEach((item) => {
        statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
        channelCounts.set(item.channel ?? '未知渠道', (channelCounts.get(item.channel ?? '未知渠道') ?? 0) + 1);
        const summary = summaryMap.get(item.id);
        if (summary) {
          totalMessages += summary.message_count;
          if (summary.satisfaction_score !== null && summary.satisfaction_score !== undefined) {
            totalSatisfaction += summary.satisfaction_score;
            satisfactionSamples += 1;
          }
        }
      });

      return {
        historyCount: recentHistory.length,
        summaryCount: summaryMap.size,
        totalMessages,
        averageSatisfaction:
          satisfactionSamples > 0 ? Number((totalSatisfaction / satisfactionSamples).toFixed(2)) : null,
        statusBreakdown:
          conversationAnalytics.status_distribution.length > 0
            ? conversationAnalytics.status_distribution
            : [...statusCounts.entries()]
                .map(([label, value]) => ({ label, value }))
                .sort((left, right) => right.value - left.value),
        channelBreakdown:
          conversationAnalytics.channel_distribution.length > 0
            ? conversationAnalytics.channel_distribution
            : [...channelCounts.entries()]
                .map(([label, value]) => ({ label, value }))
                .sort((left, right) => right.value - left.value),
        recentItems: recentHistory.slice(0, 8).map((item) => {
          const summary = summaryMap.get(item.id);
          return {
            id: item.id,
            customer_profile_id: item.customer_profile_id,
            channel: item.channel,
            status: item.status,
            last_message_at: item.last_message_at,
            message_count: summary?.message_count ?? 0,
            satisfaction_score: summary?.satisfaction_score ?? null,
            ai_summary: summary?.ai_summary ?? item.summary,
          };
        }),
        lastRefreshedAt: conversationAnalytics.last_refreshed_at,
        conversationAnalytics,
        serviceAnalytics,
        transferTrend: conversationAnalytics.trend.map((item) => ({
          label: item.date,
          value: item.transferred_count,
        })),
        ticketPriorityBreakdown: serviceAnalytics.distribution.ticket_priority,
        leaveSourceBreakdown: serviceAnalytics.distribution.leave_message_source,
      };
    },
  });
}

export function useAuthState() {
  const token = getStoredAccessToken();

  return useQuery({
    queryKey: ['platform-api', 'auth-state', token ?? 'anonymous'],
    enabled: Boolean(token),
    queryFn: async (): Promise<{ isAuthenticated: boolean; user: AuthUser | null; permissions: string[] }> => {
      try {
        const current = await requestJson<CurrentPermissions>('/auth/me/permissions');
        return {
          isAuthenticated: true,
          user: current.user,
          permissions: current.permissions,
        };
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          clearStoredAccessToken();
          return {
            isAuthenticated: false,
            user: null,
            permissions: [],
          };
        }
        throw error;
      }
    },
    retry: false,
    initialData: token
      ? undefined
      : {
          isAuthenticated: false,
          user: null,
          permissions: [],
        },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      clearStoredAccessToken();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api', 'auth-state'] });
    },
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: async (payload: LoginInput) => {
      const response = await requestJson<LoginResponse>('/auth/login', {
        method: 'POST',
        body: payload,
      });
      setStoredAccessToken(response.access_token);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-api'] });
    },
  });
}
