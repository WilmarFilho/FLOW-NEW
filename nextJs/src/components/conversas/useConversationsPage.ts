'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function upsertMessage(
  current: ConversationMessage[],
  incoming: ConversationMessage,
) {
  const index = current.findIndex((item) => item.id === incoming.id);

  if (index >= 0) {
    const next = [...current];
    next[index] = incoming;
    return next;
  }

  return [...current, incoming].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function removeMessage(current: ConversationMessage[], messageId: string) {
  return current.filter((item) => item.id !== messageId);
}

function buildConversationPreviewFromMessage(message: Partial<ConversationMessage>) {
  if (message.content?.trim()) {
    return message.content.trim();
  }

  if (message.message_type === 'audio') {
    return 'Audio enviado';
  }

  if (message.message_type === 'image') {
    return 'Imagem enviada';
  }

  if (message.message_type === 'video') {
    return 'Video enviado';
  }

  if (message.message_type === 'sticker') {
    return 'Figurinha enviada';
  }

  return 'Nova mensagem';
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
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
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
  const nextMessagesOffsetRef = useRef<number | null>(0);

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

  const assignedUsersRef = useRef<ConversationAssignedOption[]>([]);
  useEffect(() => {
    assignedUsersRef.current = options?.assignedUsers ?? [];
  }, [options?.assignedUsers]);

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

  const patchConversationInState = useCallback(
    (
      conversationId: string,
      updater: (current: ConversationSummary) => ConversationSummary,
    ) => {
      setConversations((current) => {
        const index = current.findIndex((item) => item.id === conversationId);
        if (index < 0) {
          return current;
        }

        const next = [...current];
        next[index] = updater(next[index]);
        return next.sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime(),
        );
      });

      void mutateSelectedConversation((current) => {
        if (!current || current.id !== conversationId) {
          return current;
        }

        return updater(current);
      }, false);
    },
    [mutateSelectedConversation],
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

      const offset = mode === 'appendOlder' ? nextMessagesOffsetRef.current ?? 0 : 0;

      if (mode === 'appendOlder' && nextMessagesOffsetRef.current === null) {
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
        nextMessagesOffsetRef.current = response.nextOffset;
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
    [selectedConversationId, userId],
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
      nextMessagesOffsetRef.current = 0;
      return;
    }

    setNextMessagesOffset(0);
    nextMessagesOffsetRef.current = 0;
    void loadMessages('replace');
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation?.unread_count || !userId) {
      return;
    }

    apiRequest(`/conversas/${selectedConversationId}/read`, {
      method: 'PATCH',
      userId,
    })
      .then(() => {
        patchConversationInState(selectedConversationId, (current) => ({
          ...current,
          unread_count: 0,
        }));
      })
      .catch(() => undefined);
  }, [
    patchConversationInState,
    selectedConversation?.unread_count,
    selectedConversationId,
    userId,
  ]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleConversationChange = (
      payload: RealtimePostgresChangesPayload<Partial<ConversationSummary>>,
    ) => {
      const record =
        payload.eventType === 'DELETE'
          ? (payload.old as Partial<ConversationSummary> | null)
          : (payload.new as Partial<ConversationSummary> | null);

      if (!record?.id) {
        return;
      }

      const recordId = record.id;

      if (payload.eventType === 'DELETE') {
        setConversations((current) => current.filter((item) => item.id !== recordId));
        if (selectedConversationId === recordId) {
          setSelectedConversationId(null);
          setMessages([]);
        }
        return;
      }

      if (payload.eventType === 'INSERT') {
        void apiRequest<ConversationSummary>(`/conversas/${recordId}`, { userId })
          .then((newConv) => {
            setConversations((current) => {
              if (current.some(c => c.id === newConv.id)) return current;
              return [newConv, ...current].sort(
                (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
              );
            });
          })
          .catch(() => undefined);
        return;
      }

      patchConversationInState(recordId, (current) => {
        let profile = current.profile;

        if (record.assigned_user_id !== undefined && record.assigned_user_id !== current.assigned_user_id) {
          if (record.assigned_user_id === null) {
            profile = null;
          } else {
            const matchedUser = assignedUsersRef.current.find(
              (u) => u.auth_id === record.assigned_user_id
            );
            if (matchedUser) {
              profile = {
                auth_id: matchedUser.auth_id,
                nome_completo: matchedUser.nome_completo,
                foto_perfil: null,
              };
            } else {
              setTimeout(() => {
                void apiRequest<ConversationSummary>(`/conversas/${recordId}`, { userId })
                  .then((newConv) => {
                    patchConversationInState(recordId, () => newConv);
                  })
                  .catch(() => undefined);
              }, 0);
            }
          }
        }

        return {
          ...current,
          ...record,
          profile,
        };
      });
    };

    const handleMessageChange = (
      payload: RealtimePostgresChangesPayload<ConversationMessage>,
    ) => {
      const record =
        payload.eventType === 'DELETE'
          ? (payload.old as ConversationMessage | null)
          : (payload.new as ConversationMessage | null);

      if (!record?.conversa_id) {
        return;
      }

      if (record.conversa_id === selectedConversationId) {
        setMessages((current) =>
          payload.eventType === 'DELETE'
            ? removeMessage(current, record.id)
            : upsertMessage(current, record),
        );
      }

      patchConversationInState(record.conversa_id, (current) => ({
        ...current,
        last_message_at: record.created_at || current.last_message_at,
        last_message_preview:
          payload.eventType === 'DELETE'
            ? current.last_message_preview
            : buildConversationPreviewFromMessage(record),
        unread_count:
          record.direction === 'inbound'
            ? current.unread_count + 1
            : current.unread_count,
        updated_at: record.updated_at || current.updated_at,
      }));
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
    patchConversationInState,
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
      setConversations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
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

  const renameConversationContact = async (contactId: string, nome: string) => {
    if (!userId) {
      return;
    }

    const trimmedName = nome.trim();
    if (!trimmedName) {
      throw new Error('Informe o nome do contato.');
    }

    const updatedContact = await apiRequest<{
      id: string;
      nome: string;
    }>(`/contatos/${contactId}`, {
      method: 'PATCH',
      userId,
      body: { nome: trimmedName },
    });

    setConversations((current) =>
      current.map((conversation) => {
        const contact = conversation.contatos;

        if (Array.isArray(contact)) {
          return {
            ...conversation,
            contatos: contact.map((item) =>
              item.id === updatedContact.id ? { ...item, nome: updatedContact.nome } : item,
            ),
          };
        }

        if (contact?.id === updatedContact.id) {
          return {
            ...conversation,
            contatos: { ...contact, nome: updatedContact.nome },
          };
        }

        return conversation;
      }),
    );

    await mutateSelectedConversation((current) => {
      if (!current) {
        return current;
      }

      const contact = current.contatos;

      if (Array.isArray(contact)) {
        return {
          ...current,
          contatos: contact.map((item) =>
            item.id === updatedContact.id ? { ...item, nome: updatedContact.nome } : item,
          ),
        };
      }

      if (contact?.id === updatedContact.id) {
        return {
          ...current,
          contatos: { ...contact, nome: updatedContact.nome },
        };
      }

      return current;
    }, false);

    return updatedContact;
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
      patchConversationInState(selectedConversationId, (current) => ({
        ...current,
        ai_disabled_at: enabled ? null : new Date().toISOString(),
        ai_enabled: enabled,
        updated_at: new Date().toISOString(),
      }));
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

  const updateConversationAssignment = async (assignedUserId: string) => {
    if (!userId || !selectedConversationId) {
      return;
    }

    setIsUpdatingAssignment(true);

    try {
      const updated = await apiRequest<ConversationSummary>(
        `/conversas/${selectedConversationId}/assignment`,
        {
          method: 'PATCH',
          userId,
          body: { assigned_user_id: assignedUserId || null },
        },
      );

      patchConversationInState(selectedConversationId, () => updated);
      await mutateSelectedConversation(updated, false);
      toast.success(
        updated.assigned_user_id
          ? 'Responsável atualizado.'
          : 'Conversa liberada para outro responsável.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o responsável da conversa.',
      );
      throw error;
    } finally {
      setIsUpdatingAssignment(false);
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
    isUpdatingAssignment,
    loadMoreConversations: () => loadConversations('append'),
    loadOlderMessages: () => loadMessages('appendOlder'),
    mobilePane,
    options,
    canManageAssignments: options?.canManageAssignments ?? false,
    search,
    renameConversationContact,
    selectedAssignedUserId,
    selectedConnectionId,
    selectedConversation,
    selectedConversationId,
    selectConversation,
    sendMessage,
    updateConversationAssignment,
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
