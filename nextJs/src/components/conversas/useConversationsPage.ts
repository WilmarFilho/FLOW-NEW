'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch, apiRequest } from '@/lib/api/client';
import type {
  ConversationAssignedOption,
  ConversationFilter,
  ConversationMessage,
  ConversationOptions,
  ConversationSummary,
  GroupedConversationMessage,
  MobilePane,
  PaginatedResponse,
} from './types';

const REFRESH_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000,
};

const CONVERSATIONS_PAGE_SIZE = 25;
const MESSAGES_PAGE_SIZE = 30;

function groupMessages(messages: ConversationMessage[]): GroupedConversationMessage[] {
  const groups: GroupedConversationMessage[] = [];

  messages.forEach((message) => {
    const previousGroup = groups[groups.length - 1];
    const previousMessage = previousGroup?.messages[previousGroup.messages.length - 1];
    const sameSender =
      previousGroup &&
      previousGroup.senderType === message.sender_type &&
      previousGroup.direction === message.direction;
    const sameWindow =
      previousMessage &&
      Math.abs(
        new Date(message.created_at).getTime() -
          new Date(previousMessage.created_at).getTime(),
      ) <=
        4 * 60 * 1000;

    if (sameSender && sameWindow) {
      previousGroup.messages.push(message);
      return;
    }

    groups.push({
      id: message.id,
      messages: [message],
      senderType: message.sender_type,
      direction: message.direction,
      createdAt: message.created_at,
    });
  });

  return groups;
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

function mergeConversationPages(
  current: ConversationSummary[],
  next: ConversationSummary[],
) {
  const merged = [...current];

  next.forEach((conversation) => {
    const index = merged.findIndex((item) => item.id === conversation.id);
    if (index >= 0) {
      merged[index] = conversation;
      return;
    }

    merged.push(conversation);
  });

  return merged;
}

export function useConversationsPage() {
  const [userId, setUserId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedAssignedUserId, setSelectedAssignedUserId] = useState('');
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextConversationsOffset, setNextConversationsOffset] = useState<number | null>(0);
  const [nextMessagesOffset, setNextMessagesOffset] = useState<number | null>(0);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setUserId(user.id);
      }
    });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchDebounced(search.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const optionsKey = userId ? ['conversation-options', userId] : null;
  const detailKey =
    userId && selectedConversationId
      ? ['conversation-detail', selectedConversationId, userId]
      : null;

  const { data: options, isLoading: isLoadingOptions } = useSWR<ConversationOptions>(
    optionsKey,
    ([, uid]) => apiRequest<ConversationOptions>('/conversas/options', { userId: uid }),
    REFRESH_OPTIONS,
  );

  const {
    data: selectedConversation,
    isLoading: isLoadingConversation,
    mutate: mutateSelectedConversation,
  } = useSWR<ConversationSummary>(
    detailKey,
    ([, conversationId, uid]) =>
      apiRequest<ConversationSummary>(`/conversas/${conversationId}`, { userId: uid }),
    REFRESH_OPTIONS,
  );

  const loadConversations = useCallback(
    async (mode: 'append' | 'replace' = 'replace') => {
      if (!userId) {
        return;
      }

      const offset = mode === 'append' ? nextConversationsOffset ?? 0 : 0;

      if (mode === 'append' && nextConversationsOffset === null) {
        return;
      }

      if (mode === 'append') {
        setIsLoadingMoreConversations(true);
      } else {
        setIsLoadingConversations(true);
      }

      try {
        const response = await apiRequest<PaginatedResponse<ConversationSummary>>(
          `/conversas${buildQuery({
            assignedUserId: selectedAssignedUserId || undefined,
            filter,
            limit: CONVERSATIONS_PAGE_SIZE,
            offset,
            search: searchDebounced || undefined,
            whatsappConnectionId: selectedConnectionId || undefined,
          })}`,
          { userId },
        );

        setConversations((current) =>
          mode === 'append'
            ? mergeConversationPages(current, response.items)
            : response.items,
        );
        setHasMoreConversations(response.hasMore);
        setNextConversationsOffset(response.nextOffset);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as conversas.',
        );
      } finally {
        setIsLoadingConversations(false);
        setIsLoadingMoreConversations(false);
      }
    },
    [
      filter,
      nextConversationsOffset,
      searchDebounced,
      selectedAssignedUserId,
      selectedConnectionId,
      userId,
    ],
  );

  const loadMessages = useCallback(
    async (mode: 'appendOlder' | 'replace' = 'replace') => {
      if (!userId || !selectedConversationId) {
        return;
      }

      const offset = mode === 'appendOlder' ? nextMessagesOffset ?? 0 : 0;

      if (mode === 'appendOlder' && nextMessagesOffset === null) {
        return;
      }

      if (mode === 'appendOlder') {
        setIsLoadingMoreMessages(true);
      } else {
        setIsLoadingMessages(true);
      }

      try {
        const response = await apiRequest<PaginatedResponse<ConversationMessage>>(
          `/conversas/${selectedConversationId}/messages${buildQuery({
            limit: MESSAGES_PAGE_SIZE,
            offset,
          })}`,
          { userId },
        );

        setMessages((current) => {
          if (mode === 'replace') {
            return response.items;
          }

          const next = [...response.items, ...current];
          return next.filter(
            (message, index, array) =>
              array.findIndex((item) => item.id === message.id) === index,
          );
        });
        setHasMoreMessages(response.hasMore);
        setNextMessagesOffset(response.nextOffset);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as mensagens.',
        );
      } finally {
        setIsLoadingMessages(false);
        setIsLoadingMoreMessages(false);
      }
    },
    [nextMessagesOffset, selectedConversationId, userId],
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadConversations('replace');
  }, [loadConversations, userId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setHasMoreMessages(false);
      setNextMessagesOffset(0);
      return;
    }

    void loadMessages('replace');
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation?.unread_count || !userId) {
      return;
    }

    apiRequest(`/conversas/${selectedConversationId}/read`, {
      method: 'PATCH',
      userId,
    })
      .then(() => Promise.all([loadConversations('replace'), mutateSelectedConversation()]))
      .catch(() => undefined);
  }, [
    loadConversations,
    mutateSelectedConversation,
    selectedConversation?.unread_count,
    selectedConversationId,
    userId,
  ]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const refreshConversations = () => {
      void loadConversations('replace');
    };

    const refreshMessages = () => {
      if (selectedConversationId) {
        void loadMessages('replace');
        void mutateSelectedConversation();
      }
    };

    const handleConversationChange = () => {
      refreshConversations();
      refreshMessages();
    };

    const handleMessageChange = (
      payload: RealtimePostgresChangesPayload<{ conversa_id?: string }>,
    ) => {
      const record = (payload.new || payload.old) as
        | { conversa_id?: string }
        | null;

      if (record?.conversa_id && !selectedConversationId) {
        setSelectedConversationId(record.conversa_id);
      }

      refreshConversations();
      if (!record?.conversa_id || record.conversa_id === selectedConversationId) {
        refreshMessages();
      }
    };

    const channel = supabase
      .channel(`conversas-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas' },
        handleConversationChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas_mensagens' },
        handleMessageChange,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    loadConversations,
    loadMessages,
    mutateSelectedConversation,
    selectedConversationId,
    userId,
  ]);

  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  const createConversation = async (payload: {
    whatsapp_connection_id: string;
    contato_id?: string;
    contact_name?: string;
    contact_whatsapp?: string;
  }) => {
    if (!userId) {
      return;
    }

    setIsCreatingConversation(true);

    try {
      const created = await apiRequest<ConversationSummary>('/conversas', {
        method: 'POST',
        userId,
        body: payload,
      });

      toast.success('Conversa pronta para atendimento.');
      setIsComposerOpen(false);
      setSelectedConversationId(created.id);
      setMobilePane('chat');
      await Promise.all([loadConversations('replace'), mutateSelectedConversation()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a conversa.',
      );
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const sendMessage = async (content: string, replyToMessageId?: string) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    setIsSendingMessage(true);

    try {
      await apiRequest(`/conversas/${selectedConversationId}/messages`, {
        method: 'POST',
        userId,
        body: { content, reply_to_message_id: replyToMessageId },
      });

      await Promise.all([
        loadMessages('replace'),
        loadConversations('replace'),
        mutateSelectedConversation(),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.',
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  const uploadMessageFile = async (
    file: File,
    options?: { caption?: string; replyToMessageId?: string },
  ) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    setIsSendingMessage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (options?.caption?.trim()) {
        formData.append('caption', options.caption.trim());
      }
      if (options?.replyToMessageId) {
        formData.append('reply_to_message_id', options.replyToMessageId);
      }

      const response = await apiFetch(`/conversas/${selectedConversationId}/messages/upload`, {
        method: 'POST',
        userId,
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message || 'Não foi possível enviar o arquivo.');
      }

      await Promise.all([
        loadMessages('replace'),
        loadConversations('replace'),
        mutateSelectedConversation(),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.',
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  const deleteConversationMessage = async (messageId: string) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    try {
      await apiRequest(`/conversas/${selectedConversationId}/messages/${messageId}`, {
        method: 'DELETE',
        userId,
      });

      await Promise.all([
        loadMessages('replace'),
        loadConversations('replace'),
        mutateSelectedConversation(),
      ]);
      toast.success('Mensagem excluída.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir a mensagem.',
      );
    }
  };

  const toggleAi = async (enabled: boolean) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    setIsTogglingAi(true);

    try {
      await apiRequest(`/conversas/${selectedConversationId}/ai`, {
        method: 'PATCH',
        userId,
        body: { enabled },
      });

      toast.success(enabled ? 'IA reativada.' : 'IA desativada para atendimento manual.');
      await Promise.all([loadConversations('replace'), mutateSelectedConversation()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a automação desta conversa.',
      );
    } finally {
      setIsTogglingAi(false);
    }
  };

  const selectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobilePane('chat');
  };

  const assignedUsers: ConversationAssignedOption[] = options?.assignedUsers ?? [];

  return {
    assignedUsers,
    conversations,
    createConversation,
    filter,
    goBackToList: () => setMobilePane('list'),
    groupedMessages,
    hasMoreConversations,
    hasMoreMessages,
    isComposerOpen,
    isCreatingConversation,
    isLoadingConversation,
    isLoadingConversations,
    isLoadingMessages,
    isLoadingMoreConversations,
    isLoadingMoreMessages,
    isLoadingOptions,
    isSendingMessage,
    isTogglingAi,
    loadMoreConversations: () => loadConversations('append'),
    loadOlderMessages: () => loadMessages('appendOlder'),
    mobilePane,
    options,
    search,
    selectedAssignedUserId,
    selectedConnectionId,
    selectedConversation,
    selectedConversationId,
    selectConversation,
    sendMessage,
    uploadMessageFile,
    deleteConversationMessage,
    setFilter,
    setIsComposerOpen,
    setSearch,
    setSelectedAssignedUserId,
    setSelectedConnectionId,
    toggleAi,
  };
}
