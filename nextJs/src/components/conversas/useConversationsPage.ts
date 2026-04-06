'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { apiRequest } from '@/lib/api/client';
import type {
  ConversationFilter,
  ConversationMessage,
  ConversationOptions,
  ConversationSummary,
  GroupedConversationMessage,
  MobilePane,
} from './types';

const REFRESH_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000,
};

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

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function useConversationsPage() {
  const [userId, setUserId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setUserId(user.id);
      }
    });
  }, []);

  const conversationsKey = userId ? ['conversations', userId] : null;
  const optionsKey = userId ? ['conversation-options', userId] : null;
  const detailKey =
    userId && selectedConversationId
      ? ['conversation-detail', selectedConversationId, userId]
      : null;
  const messagesKey =
    userId && selectedConversationId
      ? ['conversation-messages', selectedConversationId, userId]
      : null;

  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    mutate: mutateConversations,
  } = useSWR<ConversationSummary[]>(
    conversationsKey,
    ([, uid]) => apiRequest<ConversationSummary[]>('/conversas', { userId: uid }),
    REFRESH_OPTIONS,
  );

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

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    mutate: mutateMessages,
  } = useSWR<ConversationMessage[]>(
    messagesKey,
    ([, conversationId, uid]) =>
      apiRequest<ConversationMessage[]>(`/conversas/${conversationId}/messages`, {
        userId: uid,
      }),
    REFRESH_OPTIONS,
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    const refreshConversations = () => {
      void mutateConversations();
      window.setTimeout(() => {
        void mutateConversations();
      }, 350);
    };

    const handleConversationChange = (
      payload: RealtimePostgresChangesPayload<{ id?: string }>,
    ) => {
      const record = (payload.new || payload.old) as { id?: string } | null;

      refreshConversations();
      if (selectedConversationId) {
        void mutateSelectedConversation();
      } else if (payload.eventType === 'INSERT' && record?.id) {
        setSelectedConversationId(record.id);
        setMobilePane('chat');
      }
    };

    const handleMessageChange = (
      payload: RealtimePostgresChangesPayload<{ conversa_id?: string }>,
    ) => {
      const record = (payload.new || payload.old) as
        | { conversa_id?: string }
        | null;

      if (!record?.conversa_id) {
        refreshConversations();
        return;
      }

      if (!selectedConversationId) {
        setSelectedConversationId(record.conversa_id);
      }

      if (record.conversa_id === selectedConversationId) {
        void mutateMessages();
        void mutateSelectedConversation();
      }

      refreshConversations();
      window.setTimeout(() => {
        if (record.conversa_id === selectedConversationId || !selectedConversationId) {
          void mutateMessages();
          void mutateSelectedConversation();
        }
      }, 350);
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
    mutateConversations,
    mutateMessages,
    mutateSelectedConversation,
    selectedConversationId,
    userId,
  ]);

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
      .then(() => Promise.all([mutateConversations(), mutateSelectedConversation()]))
      .catch(() => undefined);
  }, [
    mutateConversations,
    mutateSelectedConversation,
    selectedConversation?.unread_count,
    selectedConversationId,
    userId,
  ]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const contact = unwrapRelation(conversation.contatos);
      const matchesQuery =
        !query ||
        contact?.nome?.toLowerCase().includes(query) ||
        contact?.whatsapp?.toLowerCase().includes(query) ||
        conversation.last_message_preview?.toLowerCase().includes(query);

      if (!matchesQuery) {
        return false;
      }

      if (filter === 'mine') {
        return conversation.assigned_user_id === userId;
      }

      if (filter === 'unread') {
        return conversation.unread_count > 0;
      }

      if (filter === 'ai') {
        return conversation.ai_enabled;
      }

      return true;
    });
  }, [conversations, filter, search, userId]);

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
      await Promise.all([mutateConversations(), mutateSelectedConversation()]);
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

  const sendMessage = async (content: string) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    setIsSendingMessage(true);

    try {
      await apiRequest(`/conversas/${selectedConversationId}/messages`, {
        method: 'POST',
        userId,
        body: { content },
      });

      await Promise.all([
        mutateMessages(),
        mutateConversations(),
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
      await Promise.all([mutateConversations(), mutateSelectedConversation()]);
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

  return {
    filteredConversations,
    groupedMessages,
    isComposerOpen,
    isCreatingConversation,
    isLoadingConversation,
    isLoadingConversations,
    isLoadingMessages,
    isLoadingOptions,
    isSendingMessage,
    isTogglingAi,
    mobilePane,
    options,
    search,
    filter,
    selectedConversation,
    selectedConversationId,
    createConversation,
    goBackToList: () => setMobilePane('list'),
    selectConversation,
    sendMessage,
    setFilter,
    setIsComposerOpen,
    setSearch,
    toggleAi,
  };
}
