'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  CircleOff,
  Clock3,
  Filter,
  Image as ImageIcon,
  MessageSquarePlus,
  Mic,
  Search,
  Send,
  Sparkles,
  Sticker,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import {
  cardEntrance,
  listStagger,
  pageEntrance,
  sectionEntrance,
} from '@/lib/motion/variants';
import NewConversationModal from './NewConversationModal';
import { useConversationsPage } from './useConversationsPage';
import styles from './ConversationsPage.module.css';
import type {
  ConversationFilter,
  ConversationMessage,
  ConversationSummary,
  GroupedConversationMessage,
} from './types';

const FILTER_LABELS: Record<ConversationFilter, string> = {
  all: 'Todas',
  mine: 'Minhas',
  unread: 'Não lidas',
  ai: 'IA ativa',
};

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat(
    'pt-BR',
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' },
  ).format(date);
}

function formatFullDate(value: string | null) {
  if (!value) {
    return 'Ainda não definido';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function canManuallyReply(conversation?: ConversationSummary) {
  if (!conversation || conversation.ai_enabled || !conversation.ai_disabled_at) {
    return false;
  }

  return Date.now() - new Date(conversation.ai_disabled_at).getTime() >= 60_000;
}

function getDisabledCountdown(conversation?: ConversationSummary) {
  if (!conversation?.ai_disabled_at || conversation.ai_enabled) {
    return 0;
  }

  const elapsed = Date.now() - new Date(conversation.ai_disabled_at).getTime();
  return Math.max(0, 60 - Math.floor(elapsed / 1_000));
}

function renderMessageContent(message: ConversationMessage) {
  if (message.message_type === 'text') {
    return <p className={styles.messageText}>{message.content}</p>;
  }

  if (message.message_type === 'image' || message.message_type === 'sticker') {
    return (
      <div className={styles.mediaWrapper}>
        {message.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.media_url}
            alt={message.content || 'Mídia recebida'}
            className={styles.mediaImage}
          />
        ) : (
          <div className={styles.unsupportedMedia}>
            {message.message_type === 'sticker' ? <Sticker size={18} /> : <ImageIcon size={18} />}
            <span>Mídia indisponível</span>
          </div>
        )}
        {message.content ? <p className={styles.messageCaption}>{message.content}</p> : null}
      </div>
    );
  }

  if (message.message_type === 'audio') {
    return (
      <div className={styles.mediaWrapper}>
        <div className={styles.audioLabel}>
          <Mic size={16} />
          <span>Áudio</span>
        </div>
        {message.media_url ? (
          <audio controls className={styles.audioPlayer} src={message.media_url} />
        ) : (
          <p className={styles.messageText}>Áudio indisponível para reprodução.</p>
        )}
      </div>
    );
  }

  if (message.message_type === 'video') {
    return (
      <div className={styles.mediaWrapper}>
        {message.media_url ? (
          <video controls className={styles.mediaVideo} src={message.media_url} />
        ) : (
          <div className={styles.unsupportedMedia}>
            <Video size={18} />
            <span>Vídeo indisponível</span>
          </div>
        )}
        {message.content ? <p className={styles.messageCaption}>{message.content}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.unsupportedMedia}>
      <CircleOff size={18} />
      <span>Mensagem não suportada</span>
    </div>
  );
}

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const contact = unwrapRelation(conversation.contatos);
  const assignedUser = unwrapRelation(conversation.profile);
  const connection = unwrapRelation(conversation.whatsapp_connections);

  return (
    <button
      type="button"
      className={`${styles.chatCard} ${isActive ? styles.chatCardActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.chatAvatar}>
        {contact?.avatar_url ? (
          <Image src={contact.avatar_url} alt={contact.nome} fill sizes="48px" className={styles.chatAvatarImage} />
        ) : (
          <span>{contact?.nome?.charAt(0).toUpperCase() || '#'}</span>
        )}
      </div>

      <div className={styles.chatCardBody}>
        <div className={styles.chatCardHeader}>
          <strong>{contact?.nome || 'Contato sem nome'}</strong>
          <span>{formatConversationTime(conversation.last_message_at)}</span>
        </div>

        <p className={styles.chatCardPreview}>
          {conversation.last_message_preview || 'Conversa pronta para atendimento'}
        </p>

        <div className={styles.chatCardMeta}>
          <span>{contact?.whatsapp || 'Sem número'}</span>
          <span>{connection?.nome || 'Sem conexão'}</span>
        </div>
      </div>

      <div className={styles.chatCardBadges}>
        {conversation.ai_enabled ? (
          <span className={styles.aiBadge}>
            <Bot size={12} />
            IA
          </span>
        ) : null}
        {assignedUser?.nome_completo ? (
          <span className={styles.ownerBadge}>{assignedUser.nome_completo}</span>
        ) : null}
        {conversation.unread_count > 0 ? (
          <span className={styles.unreadBadge}>{conversation.unread_count}</span>
        ) : null}
      </div>
    </button>
  );
}

function MessageGroup({ group }: { group: GroupedConversationMessage }) {
  const isInbound = group.direction === 'inbound';
  const isSystem = group.direction === 'system';

  return (
    <div
      className={`${styles.messageGroup} ${isSystem
        ? styles.messageGroupSystem
        : isInbound
          ? styles.messageGroupInbound
          : styles.messageGroupOutbound
        }`}
    >
      {group.messages.map((message) => (
        <div
          key={message.id}
          className={`${styles.messageBubble} ${isSystem
            ? styles.messageBubbleSystem
            : isInbound
              ? styles.messageBubbleInbound
              : styles.messageBubbleOutbound
            }`}
        >
          {renderMessageContent(message)}
        </div>
      ))}
      <span className={styles.messageTimestamp}>{formatFullDate(group.createdAt)}</span>
    </div>
  );
}

export default function ConversationsPage() {
  const {
    createConversation,
    filter,
    filteredConversations,
    goBackToList,
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
    selectedConversation,
    selectedConversationId,
    selectConversation,
    sendMessage,
    setFilter,
    setIsComposerOpen,
    setSearch,
    toggleAi,
  } = useConversationsPage();
  const [draftMessage, setDraftMessage] = useState('');
  const [, forceTick] = useState(0);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const contact = useMemo(
    () => unwrapRelation(selectedConversation?.contatos),
    [selectedConversation?.contatos],
  );
  const connection = useMemo(
    () => unwrapRelation(selectedConversation?.whatsapp_connections),
    [selectedConversation?.whatsapp_connections],
  );
  const assignedUser = useMemo(
    () => unwrapRelation(selectedConversation?.profile),
    [selectedConversation?.profile],
  );

  const manualReplyReady = canManuallyReply(selectedConversation);
  const disabledCountdown = getDisabledCountdown(selectedConversation);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }

    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [groupedMessages.length]);

  useEffect(() => {
    if (
      !selectedConversation?.ai_disabled_at ||
      selectedConversation.ai_enabled ||
      manualReplyReady
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      forceTick((current) => current + 1);
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [manualReplyReady, selectedConversation?.ai_disabled_at, selectedConversation?.ai_enabled]);

  return (
    <motion.div className={styles.page} variants={pageEntrance} initial="hidden" animate="visible">
      <motion.section
        className={styles.workspace}
        variants={sectionEntrance}
        initial="hidden"
        animate="visible"
      >
        <div
          className={`${styles.sidebar} ${mobilePane === 'chat' ? styles.sidebarHiddenMobile : ''
            }`}
        >
          <div className={styles.sidebarTop}>

            <label className={styles.searchField}>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, número ou mensagem"
              />
            </label>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setIsComposerOpen(true)}
            >
              <MessageSquarePlus size={17} />
              Nova conversa
            </button>

            <div className={styles.filterRow}>

              <div className={styles.filterChips}>
                {(Object.keys(FILTER_LABELS) as ConversationFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.filterChip} ${filter === value ? styles.filterChipActive : ''
                      }`}
                    onClick={() => setFilter(value)}
                  >
                    {FILTER_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.chatListWrap}>
            {isLoadingConversations ? (
              <div className={styles.centerState}>
                <div className={styles.spinner} />
                <span>Carregando conversas...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className={styles.emptyPanel}>
                <Sparkles size={24} />
                <strong>Nenhuma conversa por aqui</strong>
                <p>Ajuste os filtros ou abra uma nova conversa para começar.</p>
              </div>
            ) : (
              <motion.div
                className={styles.chatList}
                variants={listStagger}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence initial={false}>
                  {filteredConversations.map((conversation) => (
                    <motion.div key={conversation.id} variants={cardEntrance} layout>
                      <ConversationListItem
                        conversation={conversation}
                        isActive={conversation.id === selectedConversationId}
                        onClick={() => selectConversation(conversation.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        <div
          className={`${styles.chatPanel} ${mobilePane === 'list' ? styles.chatPanelHiddenMobile : ''
            }`}
        >
          {!selectedConversationId ? (
            <div className={styles.emptyChat}>
              <MessageSquarePlus size={28} />
              <strong>Selecione uma conversa</strong>
              <p>Escolha um chat na lista ou crie uma nova conversa para atender.</p>
            </div>
          ) : isLoadingConversation || isLoadingMessages ? (
            <div className={styles.centerState}>
              <div className={styles.spinner} />
              <span>Carregando chat...</span>
            </div>
          ) : selectedConversation ? (
            <>
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderIdentity}>
                  <button
                    type="button"
                    className={styles.mobileBackButton}
                    onClick={goBackToList}
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className={styles.chatHeaderAvatar}>
                    {contact?.avatar_url ? (
                      <Image
                        src={contact.avatar_url}
                        alt={contact.nome}
                        fill
                        sizes="52px"
                        className={styles.chatAvatarImage}
                      />
                    ) : (
                      <span>{contact?.nome?.charAt(0).toUpperCase() || '#'}</span>
                    )}
                  </div>

                  <div className={styles.chatHeaderText}>
                    <strong>{contact?.nome || 'Contato sem nome'}</strong>
                    <span>
                      {contact?.whatsapp || 'Sem número'} • {connection?.nome || 'Sem conexão'}
                    </span>
                  </div>
                </div>

                <div className={styles.chatHeaderActions}>
                  <button
                    type="button"
                    className={`${styles.toggleButton} ${selectedConversation.ai_enabled ? styles.toggleButtonActive : ''
                      }`}
                    onClick={() => void toggleAi(!selectedConversation.ai_enabled)}
                    disabled={isTogglingAi}
                  >
                    <Bot size={15} />
                    {selectedConversation.ai_enabled ? 'IA ativa' : 'IA pausada'}
                  </button>
                </div>
              </div>

              <div className={styles.chatInfoBar}>
                <div className={styles.infoPill}>
                  <Clock3 size={14} />
                  <span>Atualizado em {formatFullDate(selectedConversation.last_message_at)}</span>
                </div>
                <div className={styles.infoPill}>
                  <CheckCheck size={14} />
                  <span>
                    {assignedUser?.nome_completo
                      ? `Em atendimento por ${assignedUser.nome_completo}`
                      : 'Ainda sem atendente responsável'}
                  </span>
                </div>
              </div>

              {!selectedConversation.ai_enabled ? (
                <div className={styles.noticeCard}>
                  <strong>Atendimento manual liberado com trava de segurança</strong>
                  <p>
                    {manualReplyReady
                      ? 'A IA está desativada e o envio manual já está liberado para este chat.'
                      : `Aguarde ${disabledCountdown}s após desativar a IA para enviar manualmente.`}
                  </p>
                </div>
              ) : (
                <div className={styles.noticeCard}>
                  <strong>IA ativa por padrão</strong>
                  <p>
                    Desative a IA quando quiser assumir o atendimento manualmente nesta
                    conversa.
                  </p>
                </div>
              )}

              <div ref={messagesRef} className={styles.messagesScroller}>
                {groupedMessages.length === 0 ? (
                  <div className={styles.emptyTimeline}>
                    <Sparkles size={22} />
                    <strong>Nenhuma mensagem ainda</strong>
                    <p>Assim que o cliente ou sua equipe interagir, o histórico aparece aqui.</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <MessageGroup key={group.id} group={group} />
                  ))
                )}
              </div>

              <div className={styles.composer}>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={
                    selectedConversation.ai_enabled
                      ? 'Desative a IA para responder manualmente'
                      : 'Digite sua mensagem'
                  }
                  className={styles.composerInput}
                  disabled={selectedConversation.ai_enabled || !manualReplyReady}
                />
                <button
                  type="button"
                  className={styles.sendButton}
                  disabled={
                    isSendingMessage ||
                    !draftMessage.trim() ||
                    selectedConversation.ai_enabled ||
                    !manualReplyReady
                  }
                  onClick={() => {
                    const message = draftMessage.trim();
                    if (!message) {
                      return;
                    }

                    setDraftMessage('');
                    void sendMessage(message);
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </motion.section>

      <NewConversationModal
        isOpen={isComposerOpen}
        isSubmitting={isCreatingConversation}
        options={options}
        onClose={() => setIsComposerOpen(false)}
        onSubmit={createConversation}
      />

      {isLoadingOptions ? <span className={styles.hiddenAssistive}>Carregando opções</span> : null}
    </motion.div>
  );
}
