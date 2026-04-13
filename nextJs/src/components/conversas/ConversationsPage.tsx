'use client';

import { type ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  CircleOff,
  Copy,
  Clock3,
  MoreVertical,
  Image as ImageIcon,
  MessageSquarePlus,
  Mic,
  Pencil,
  Pause,
  Paperclip,
  Play,
  Reply,
  Search,
  Send,
  Sparkles,
  Sticker,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  cardEntrance,
  listStagger,
  pageEntrance,
  sectionEntrance,
} from '@/lib/motion/variants';
import ContactRenameModal from '@/components/contatos/ContactRenameModal';
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
  deleted: 'Excluídas',
};

type FilterModalKind = 'assigned' | 'connection' | null;

type AssignmentOption = {
  description: string;
  id: string;
  label: string;
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

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function describeMessageForReply(message: ConversationMessage) {
  if (message.content?.trim()) {
    return message.content.trim();
  }

  if (message.message_type === 'audio') {
    return 'Mensagem de audio';
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

  return 'Mensagem sem texto';
}

function canDeleteForEveryone(message: ConversationMessage) {
  if (message.direction !== 'outbound') {
    return false;
  }

  const messageAge = Date.now() - new Date(message.created_at).getTime();
  return messageAge <= 48 * 60 * 60 * 1000;
}

function AudioMessagePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const syncTime = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const syncDuration = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className={styles.audioCard}>
      <audio ref={audioRef} preload="metadata" src={src} />
      <button type="button" className={styles.audioToggle} onClick={togglePlayback} aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className={styles.audioMain}>
        <div className={styles.audioTopRow}>
          <div className={styles.audioLabel}>
            <Mic size={16} />
            <span>Mensagem de áudio</span>
          </div>
          <span className={styles.audioTime}>{formatAudioTime(duration || currentTime)}</span>
        </div>
        <div className={styles.audioProgressGroup}>
          <div className={styles.audioWaveTrack} aria-hidden="true">
            <span className={styles.audioWaveFill} style={{ width: `${progress}%` }} />
          </div>
          <input
            className={styles.audioSeek}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            aria-label="Avançar áudio"
          />
        </div>
        <div className={styles.audioTimeline}>
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function RecordingWaveform() {
  return (
    <div className={styles.recordingWaveform} aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={styles.recordingBar}
          style={{ animationDelay: `${index * 0.08}s` }}
        />
      ))}
    </div>
  );
}

function FilterSelectionModal({
  description,
  isOpen,
  items,
  onClose,
  onSelect,
  search,
  setSearch,
  title,
}: {
  description: string;
  isOpen: boolean;
  items: Array<{ id: string; label: string; subtitle?: string; selected: boolean }>;
  onClose: () => void;
  onSelect: (id: string) => void;
  search: string;
  setSearch: (value: string) => void;
  title: string;
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={styles.selectionModalBackdrop}
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className={styles.selectionModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.selectionModalHeader}>
              <div>
                <strong>{title}</strong>
                <p className={styles.modalDescription}>{description}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar modal">
                <X size={16} />
              </button>
            </div>

            <label className={styles.searchField}>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar"
              />
            </label>

            <div className={styles.modalBody}>
              {items.length === 0 ? (
                <div className={styles.emptyTimeline}>
                  <Sparkles size={20} />
                  <strong>Nada encontrado</strong>
                  <p>Tente outro termo para localizar a opção.</p>
                </div>
              ) : (
                items.map((item, index) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    className={`${styles.selectionOption} ${item.selected ? styles.selectionOptionActive : ''}`}
                    onClick={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16, delay: index * 0.02 }}
                  >
                    <strong>{item.label}</strong>
                    {item.subtitle ? <span>{item.subtitle}</span> : null}
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ConversationSettingsModal({
  assignmentOptions,
  currentAssignedUserId,
  currentOwnerLabel,
  isOpen,
  isSaving,
  onApplyAssignment,
  onClose,
}: {
  assignmentOptions: AssignmentOption[];
  currentAssignedUserId: string | null;
  currentOwnerLabel: string;
  isOpen: boolean;
  isSaving: boolean;
  onApplyAssignment: (nextAssignedUserId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [draftAssignment, setDraftAssignment] = useState(currentAssignedUserId || '');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftAssignment(currentAssignedUserId || '');
  }, [currentAssignedUserId, isOpen]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={styles.modalBackdrop}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className={styles.assignmentModalShell}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Editar conversa"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Conversa</span>
                <h2 className={styles.modalTitle}>Editar atendimento</h2>
                <p className={styles.modalDescription}>
                  Ajuste quem fica responsável por esta conversa ou deixe livre para outro assumir.
                </p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={onClose}
                aria-label="Fechar modal"
                disabled={isSaving}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.assignmentModalBody}>
              <div className={styles.assignmentCurrentCard}>
                <span className={styles.assignmentCurrentLabel}>Responsável atual</span>
                <strong>{currentOwnerLabel}</strong>
              </div>

              <section className={styles.modalSection}>
                <div className={styles.sectionHeader}>
                  <h3>Responsável da conversa</h3>
                  <span>{assignmentOptions.length} opção(ões)</span>
                </div>

                <div className={styles.assignmentOptionList}>
                  {assignmentOptions.map((option) => {
                    const isActive = draftAssignment === option.id;

                    return (
                      <button
                        key={option.id || 'none'}
                        type="button"
                        className={`${styles.assignmentOptionCard} ${
                          isActive ? styles.assignmentOptionCardActive : ''
                        }`}
                        onClick={() => setDraftAssignment(option.id)}
                        disabled={isSaving}
                      >
                        <div className={styles.assignmentOptionCopy}>
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </div>
                        <span className={styles.assignmentOptionIndicator}>
                          {isActive ? 'Selecionado' : 'Selecionar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void onApplyAssignment(draftAssignment)}
                disabled={isSaving || draftAssignment === (currentAssignedUserId || '')}
              >
                {isSaving ? 'Salvando...' : 'Salvar responsável'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
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

function isConversationFromDeletedConnection(conversation?: ConversationSummary) {
  const connection = unwrapRelation(conversation?.whatsapp_connections);
  return Boolean(connection?.deleted_at);
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
        {message.media_url ? (
          <AudioMessagePlayer src={message.media_url} />
        ) : (
          <p className={styles.messageText}>Áudio indisponível para reprodução.</p>
        )}
        {message.content ? <p className={styles.messageCaption}>{message.content}</p> : null}
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
  const connection = unwrapRelation(conversation.whatsapp_connections);

  return (
    <button
      type="button"
      className={`${styles.chatCard} ${isActive ? styles.chatCardActive : ''}`}
      onClick={onClick}
      style={{
        outline: `1px solid ${connection?.cor || 'rgba(255,255,255,0.08)'}`,
        outlineOffset: '-1px',
      }}
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

      </div>
    </button>
  );
}

function MessageGroup({
  activeMenuMessageId,
  group,
  onCopy,
  onDelete,
  onReply,
  onToggleMenu,
}: {
  activeMenuMessageId: string | null;
  group: GroupedConversationMessage;
  onCopy: (message: ConversationMessage) => void;
  onDelete: (message: ConversationMessage) => void;
  onReply: (message: ConversationMessage) => void;
  onToggleMenu: (messageId: string | null) => void;
}) {
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
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={`${styles.messageBubble} ${isSystem
            ? styles.messageBubbleSystem
            : isInbound
              ? styles.messageBubbleInbound
              : styles.messageBubbleOutbound
            }`}
        >
          <div className={styles.messageBubbleShell}>
            {!isSystem ? (
              <div className={styles.messageActions}>
                <button
                  type="button"
                  className={styles.messageActionsButton}
                  onClick={() =>
                    onToggleMenu(activeMenuMessageId === message.id ? null : message.id)
                  }
                  aria-label="Abrir ações da mensagem"
                >
                  <MoreVertical size={15} />
                </button>

                {activeMenuMessageId === message.id ? (
                  <div className={styles.messageMenu}>
                    <button
                      type="button"
                      className={styles.messageMenuItem}
                      onClick={() => {
                        onToggleMenu(null);
                        onReply(message);
                      }}
                    >
                      <Reply size={15} />
                      Responder mensagem
                    </button>
                    {message.message_type === 'text' && message.content?.trim() ? (
                      <button
                        type="button"
                        className={styles.messageMenuItem}
                        onClick={() => {
                          onToggleMenu(null);
                          onCopy(message);
                        }}
                      >
                        <Copy size={15} />
                        Copiar mensagem
                      </button>
                    ) : null}
                    {canDeleteForEveryone(message) ? (
                      <button
                        type="button"
                        className={`${styles.messageMenuItem} ${styles.messageMenuItemDanger}`}
                        onClick={() => {
                          onToggleMenu(null);
                          onDelete(message);
                        }}
                      >
                        <Trash2 size={15} />
                        Excluir para todos
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {renderMessageContent(message)}
          </div>
        </motion.div>
      ))}
      <span className={styles.messageTimestamp}>{formatFullDate(group.createdAt)}</span>
    </div>
  );
}

export default function ConversationsPage() {
  const {
    assignedUsers,
    canManageAssignments,
    conversations,
    createConversation,
    deleteConversationMessage,
    filter,
    goBackToList,
    groupedMessages,
    hasMoreConversations,
    hasMoreMessages,
    isComposerOpen,
    isCreatingConversation,
    isLoadingConversation,
    isLoadingConversations,
    isLoadingMoreConversations,
    isLoadingMoreMessages,
    isLoadingMessages,
    isLoadingOptions,
    isSendingMessage,
    isTogglingAi,
    isUpdatingAssignment,
    loadMoreConversations,
    loadOlderMessages,
    mobilePane,
    options,
    renameConversationContact,
    search,
    selectedAssignedUserId,
    selectedConnectionId,
    selectedConversation,
    selectedConversationId,
    selectConversation,
    sendMessage,
    setFilter,
    setIsComposerOpen,
    setSearch,
    setSelectedAssignedUserId,
    setSelectedConnectionId,
    toggleAi,
    updateConversationAssignment,
    uploadMessageFile,
  } = useConversationsPage();
  const [draftMessage, setDraftMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<ConversationMessage | null>(null);
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeFilterModal, setActiveFilterModal] = useState<FilterModalKind>(null);
  const [filterModalSearch, setFilterModalSearch] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isMobileComposerMenuOpen, setIsMobileComposerMenuOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isRenamingContact, setIsRenamingContact] = useState(false);
  const [isConversationSettingsOpen, setIsConversationSettingsOpen] = useState(false);
  const [composerActivity, setComposerActivity] = useState<{
    kind: 'audio' | 'image' | 'text';
    label: string;
  } | null>(null);
  const [, forceTick] = useState(0);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const initialScrollPendingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);

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
  const isDeletedConnectionConversation = isConversationFromDeletedConnection(selectedConversation);
  const isComposerDisabled =
    isDeletedConnectionConversation ||
    selectedConversation?.ai_enabled ||
    !manualReplyReady ||
    isSendingMessage;
  const selectedConnectionLabel =
    options?.connections.find((item) => item.id === selectedConnectionId)?.nome ||
    'Todos os WhatsApps';
  const selectedAssignedLabel =
    assignedUsers.find((item) => item.auth_id === selectedAssignedUserId)?.nome_completo ||
    'Todos os responsaveis';

  const assignmentOptions = useMemo<AssignmentOption[]>(() => {
    if (canManageAssignments) {
      return [
        {
          id: '',
          label: 'Ninguém',
          description: 'Deixa a conversa sem responsável para outro atendente assumir.',
        },
        ...assignedUsers.map((item) => ({
          id: item.auth_id,
          label: item.nome_completo || 'Usuário',
          description: 'Atribui a conversa diretamente para este responsável.',
        })),
      ];
    }

    return [
      {
        id: '',
        label: 'Liberar conversa',
        description: 'Remove você desta conversa para outro atendente assumir depois.',
      },
    ];
  }, [assignedUsers, canManageAssignments]);

  const scrollToLatestMessage = (behavior: ScrollBehavior = 'auto') => {
    const endNode = messagesEndRef.current;
    const container = messagesRef.current;

    if (endNode) {
      endNode.scrollIntoView({ block: 'end', behavior });
      return;
    }

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  const filterModalItems = useMemo(() => {
    const query = filterModalSearch.trim().toLowerCase();
    const source =
      activeFilterModal === 'connection'
        ? [
          {
            id: '',
            label: 'Todos os WhatsApps',
            selected: !selectedConnectionId,
            subtitle: 'Todas as conexoes ativas',
          },
          ...(options?.connections ?? []).map((item) => ({
            id: item.id,
            label: item.nome,
            selected: item.id === selectedConnectionId,
            subtitle: item.numero || 'Conexao conectada',
          })),
        ]
        : [
          {
            id: '',
            label: 'Todos os responsaveis',
            selected: !selectedAssignedUserId,
            subtitle: 'Conversas sem filtro por atendente',
          },
          ...assignedUsers.map((item) => ({
            id: item.auth_id,
            label: item.nome_completo || 'Usuario',
            selected: item.auth_id === selectedAssignedUserId,
            subtitle: 'Atendente da plataforma',
          })),
        ];

    if (!query) {
      return source;
    }

    return source.filter((item) =>
      `${item.label} ${item.subtitle || ''}`.toLowerCase().includes(query),
    );
  }, [
    activeFilterModal,
    assignedUsers,
    filterModalSearch,
    options?.connections,
    selectedAssignedUserId,
    selectedConnectionId,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    initialScrollPendingRef.current = true;
    shouldStickToBottomRef.current = true;
    setReplyTarget(null);
    setActiveMessageMenuId(null);
  }, [selectedConversationId]);

  useLayoutEffect(() => {
    if (
      !selectedConversationId ||
      !messagesRef.current ||
      preserveScrollRef.current ||
      !initialScrollPendingRef.current ||
      isLoadingConversation ||
      isLoadingMessages
    ) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToLatestMessage();
        initialScrollPendingRef.current = false;
      });
    });
  }, [groupedMessages.length, isLoadingConversation, isLoadingMessages, selectedConversationId]);

  useEffect(() => {
    if (!messagesRef.current || !preserveScrollRef.current) {
      return;
    }

    const snapshot = preserveScrollRef.current;
    const nextHeight = messagesRef.current.scrollHeight;
    messagesRef.current.scrollTop = nextHeight - snapshot.height + snapshot.top;
    preserveScrollRef.current = null;
  }, [groupedMessages]);

  useEffect(() => {
    if (
      !messagesRef.current ||
      preserveScrollRef.current ||
      initialScrollPendingRef.current ||
      !shouldStickToBottomRef.current
    ) {
      return;
    }

    scrollToLatestMessage();
  }, [groupedMessages]);

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

  useEffect(() => {
    setFilterModalSearch('');
  }, [activeFilterModal]);

  const handleRenameContact = async (nextName: string) => {
    if (!contact?.id) {
      return;
    }

    if (nextName.trim() === contact.nome) {
      return;
    }

    try {
      setIsRenamingContact(true);
      await renameConversationContact(contact.id, nextName.trim());
      setIsRenameModalOpen(false);
      toast.success('Nome do contato atualizado.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível atualizar o contato.',
      );
    } finally {
      setIsRenamingContact(false);
    }
  };

  const handleUpdateAssignment = async (nextAssignedUserId: string) => {
    await updateConversationAssignment(nextAssignedUserId);
    setIsConversationSettingsOpen(false);
  };

  const handleSendTextMessage = () => {
    if (isDeletedConnectionConversation) {
      toast.error('Não é possível enviar mensagens em conversas de conexões excluídas.');
      return;
    }

    const message = draftMessage.trim();
    if (!message) {
      return;
    }

    setComposerActivity({
      kind: 'text',
      label: 'Enviando mensagem...',
    });
    setDraftMessage('');
    const replyToMessageId = replyTarget?.id;
    setReplyTarget(null);
    shouldStickToBottomRef.current = true;
    setIsMobileComposerMenuOpen(false);
    void sendMessage(message, replyToMessageId).finally(() => {
      setComposerActivity(null);
    });
  };

  const handleSelectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isDeletedConnectionConversation) {
      event.target.value = '';
      toast.error('Não é possível enviar arquivos em conversas de conexões excluídas.');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const caption = draftMessage.trim();
    const replyToMessageId = replyTarget?.id;

    setComposerActivity({
      kind: file.type.startsWith('audio/') ? 'audio' : 'image',
      label: file.type.startsWith('audio/') ? 'Enviando audio...' : 'Enviando arquivo...',
    });
    setDraftMessage('');
    setReplyTarget(null);
    shouldStickToBottomRef.current = true;
    setIsMobileComposerMenuOpen(false);
    await uploadMessageFile(file, {
      caption: caption || undefined,
      replyToMessageId: replyToMessageId || undefined,
    });
    setComposerActivity(null);
    event.target.value = '';
  };

  const handleCopyMessage = async (message: ConversationMessage) => {
    if (!message.content?.trim()) {
      return;
    }

    await navigator.clipboard.writeText(message.content);
  };

  const handleDeleteMessage = (message: ConversationMessage) => {
    shouldStickToBottomRef.current = true;
    void deleteConversationMessage(message.id);
  };

  const handleMessagesScroll = () => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    shouldStickToBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 120;

    if (!hasMoreMessages || isLoadingMoreMessages) {
      return;
    }

    if (node.scrollTop < 120) {
      preserveScrollRef.current = {
        height: node.scrollHeight,
        top: node.scrollTop,
      };
      void loadOlderMessages();
    }
  };

  const toggleAudioRecording = async () => {
    if (isDeletedConnectionConversation) {
      toast.error('Não é possível enviar áudios em conversas de conexões excluídas.');
      return;
    }

    if (isRecordingAudio) {
      recorderRef.current?.stop();
      setIsMobileComposerMenuOpen(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderChunksRef.current = [];
    recorderRef.current = recorder;

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recorderChunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener('stop', () => {
      const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `audio-${Date.now()}.${extension}`, {
        type: blob.type || 'audio/webm',
      });
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      recorderChunksRef.current = [];
      setIsRecordingAudio(false);
      shouldStickToBottomRef.current = true;
      setComposerActivity({
        kind: 'audio',
        label: 'Enviando audio gravado...',
      });
      void uploadMessageFile(file, {
        caption: draftMessage.trim() || undefined,
        replyToMessageId: replyTarget?.id || undefined,
      }).finally(() => {
        setComposerActivity(null);
      });
      setDraftMessage('');
      setReplyTarget(null);
    });

    recorder.start();
    setIsRecordingAudio(true);
    setIsMobileComposerMenuOpen(false);
  };

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
              <div className={styles.filterLauncherRow}>
                <button
                  type="button"
                  className={styles.filterLauncher}
                  onClick={() => setActiveFilterModal('connection')}
                >
                  <span>WhatsApp</span>
                  <strong>{selectedConnectionLabel}</strong>
                </button>

                <button
                  type="button"
                  className={styles.filterLauncher}
                  onClick={() => setActiveFilterModal('assigned')}
                >
                  <span>Responsavel</span>
                  <strong>{selectedAssignedLabel}</strong>
                </button>
              </div>
            </div>
          </div>

          <div
            ref={chatListRef}
            className={styles.chatListWrap}
            onScroll={() => {
              const node = chatListRef.current;
              if (!node || !hasMoreConversations || isLoadingMoreConversations) {
                return;
              }

              const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
              if (remaining < 180) {
                void loadMoreConversations();
              }
            }}
          >
            {isLoadingConversations ? (
              <div className={styles.centerState}>
                <div className={styles.spinner} />
                <span>Carregando conversas...</span>
              </div>
            ) : conversations.length === 0 ? (
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
                  {conversations.map((conversation) => (
                    <motion.div key={conversation.id} variants={cardEntrance} layout>
                      <ConversationListItem
                        conversation={conversation}
                        isActive={conversation.id === selectedConversationId}
                        onClick={() => selectConversation(conversation.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoadingMoreConversations ? (
                  <div className={styles.listLoadingMore}>Carregando mais conversas...</div>
                ) : null}
              </motion.div>
            )}
          </div>
        </div>

        <div
          className={`${styles.chatPanel} ${mobilePane === 'list' ? styles.chatPanelHiddenMobile : ''
            }`}
        >
          <AnimatePresence initial={false} mode="wait">
            {!selectedConversationId ? (
              <motion.div
                key="chat-empty"
                className={styles.emptyChat}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <MessageSquarePlus size={28} />
                <strong>Selecione uma conversa</strong>
                <p>Escolha um chat na lista ou crie uma nova conversa para atender.</p>
              </motion.div>
            ) : isLoadingConversation || isLoadingMessages ? (
              <motion.div
                key={`chat-loading-${selectedConversationId}`}
                className={styles.centerState}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={styles.spinner} />
                <span>Carregando chat...</span>
              </motion.div>
            ) : selectedConversation ? (
              <motion.div
                key={`chat-${selectedConversationId}`}
                className={styles.chatConversationFrame}
                initial={{ opacity: 0, x: 26, scale: 0.992 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -14, scale: 0.996 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
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
                    {contact?.id ? (
                      <button
                        type="button"
                        className={styles.editNameButton}
                        onClick={() => setIsRenameModalOpen(true)}
                        aria-label="Editar nome do contato"
                        title="Editar nome do contato"
                      >
                        <Pencil size={15} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.editNameButton}
                      onClick={() => setIsConversationSettingsOpen(true)}
                      aria-label="Editar conversa"
                      title="Editar conversa"
                    >
                      <MoreVertical size={15} />
                    </button>
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
                    <CheckCheck size={14} />
                    <span>
                      {assignedUser?.nome_completo
                        ? `Em atendimento por ${assignedUser.nome_completo}`
                        : 'Ainda sem atendente responsável'}
                    </span>
                  </div>
                </div>

                {isDeletedConnectionConversation ? (
                  <div className={styles.noticeCard}>
                    <strong>Envio bloqueado nesta conversa</strong>

                  </div>
                ) : !selectedConversation.ai_enabled && !manualReplyReady ? (
                  <div className={styles.noticeCard}>
                    <strong>Atendimento manual em preparo</strong>
                    <p>
                      Aguarde {disabledCountdown}s para enviar mensagens manuais nesta conversa.
                    </p>
                  </div>
                ) : null}



                <div
                  ref={messagesRef}
                  className={styles.messagesScroller}
                  onScroll={handleMessagesScroll}
                >
                  {isLoadingMoreMessages ? (
                    <div className={styles.timelineLoadingMore}>Carregando mensagens anteriores...</div>
                  ) : null}
                  {groupedMessages.length === 0 ? (
                    <div className={styles.emptyTimeline}>
                      <Sparkles size={22} />
                      <strong>Nenhuma mensagem ainda</strong>
                      <p>Assim que o cliente ou sua equipe interagir, o histórico aparece aqui.</p>
                    </div>
                  ) : (
                    groupedMessages.map((group) => (
                      <MessageGroup
                        key={group.id}
                        activeMenuMessageId={activeMessageMenuId}
                        group={group}
                        onCopy={(message) => void handleCopyMessage(message)}
                        onDelete={handleDeleteMessage}
                        onReply={setReplyTarget}
                        onToggleMenu={setActiveMessageMenuId}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className={styles.composer}>
                  {composerActivity ? (
                    <div className={styles.composerStatusCard}>
                      <div className={styles.composerStatusIcon}>
                        <div className={styles.spinner} />
                      </div>
                      <div className={styles.composerStatusContent}>
                        <strong>{composerActivity.kind === 'text' ? 'Mensagem em envio' : composerActivity.kind === 'audio' ? 'Audio em envio' : 'Arquivo em envio'}</strong>
                        <p>{composerActivity.label}</p>
                      </div>
                    </div>
                  ) : null}

                  {isRecordingAudio ? (
                    <div className={styles.composerStatusCard}>
                      <div className={styles.recordingDot} />
                      <div className={styles.composerStatusContent}>
                        <strong>Gravando audio</strong>
                        <p>Toque novamente no microfone para finalizar e enviar.</p>
                      </div>
                      <RecordingWaveform />
                    </div>
                  ) : null}

                  {replyTarget ? (
                    <div className={styles.composerReplyCard}>
                      <div className={styles.composerReplyContent}>
                        <strong>Respondendo mensagem</strong>
                        <p>{describeMessageForReply(replyTarget)}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => setReplyTarget(null)}
                        aria-label="Cancelar resposta"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.composerEntry}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className={styles.hiddenFileInput}
                      onChange={(event) => void handleSelectFile(event)}
                    />
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.composerActionButton} ${styles.composerDesktopAction}`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isComposerDisabled}
                      aria-label="Enviar arquivo"
                    >
                      <Paperclip size={17} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.composerActionButton} ${styles.composerDesktopAction} ${isRecordingAudio ? styles.iconButtonActive : ''}`}
                      onClick={() => void toggleAudioRecording()}
                      disabled={isComposerDisabled}
                      aria-label={isRecordingAudio ? 'Parar gravacao' : 'Gravar audio'}
                    >
                      <Mic size={17} />
                    </button>

                    <textarea
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={
                        isDeletedConnectionConversation
                          ? 'Conexão excluída: envio de mensagens desabilitado'
                          : selectedConversation.ai_enabled
                            ? 'Desative a IA para responder manualmente'
                            : isRecordingAudio
                              ? 'Gravando audio... voce pode adicionar uma legenda'
                              : 'Digite sua mensagem'
                      }
                      className={styles.composerInput}
                      disabled={isDeletedConnectionConversation || selectedConversation.ai_enabled || !manualReplyReady}
                    />

                    <button
                      type="button"
                      className={styles.sendButton}
                      disabled={
                        isSendingMessage ||
                        !draftMessage.trim() ||
                        isDeletedConnectionConversation ||
                        selectedConversation.ai_enabled ||
                        !manualReplyReady
                      }
                      onClick={handleSendTextMessage}
                    >
                      <Send size={18} />
                    </button>

                    <div className={styles.composerMobileStack}>
                      <button
                        type="button"
                        className={styles.sendButton}
                        disabled={
                          isSendingMessage ||
                          !draftMessage.trim() ||
                          isDeletedConnectionConversation ||
                          selectedConversation.ai_enabled ||
                          !manualReplyReady
                        }
                        onClick={handleSendTextMessage}
                      >
                        <Send size={18} />
                      </button>
                      <div className={styles.mobileComposerMenuWrap}>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.composerActionButton}`}
                          disabled={isComposerDisabled}
                          onClick={() => setIsMobileComposerMenuOpen((current) => !current)}
                          aria-label="Abrir ações de mídia"
                        >
                          {isMobileComposerMenuOpen ? <X size={17} /> : <Paperclip size={17} />}
                        </button>

                        <AnimatePresence>
                          {isMobileComposerMenuOpen ? (
                            <motion.div
                              className={styles.mobileComposerMenu}
                              initial={{ opacity: 0, y: 10, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.98 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <motion.button
                                type="button"
                                className={styles.mobileComposerMenuItem}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isComposerDisabled}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ duration: 0.16, delay: 0.03 }}
                              >
                                <Paperclip size={15} />
                                Escolher arquivo
                              </motion.button>
                              <motion.button
                                type="button"
                                className={styles.mobileComposerMenuItem}
                                onClick={() => void toggleAudioRecording()}
                                disabled={isComposerDisabled}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ duration: 0.16, delay: 0.06 }}
                              >
                                <Mic size={15} />
                                {isRecordingAudio ? 'Parar gravação' : 'Gravar áudio'}
                              </motion.button>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.section>

      <NewConversationModal
        isOpen={isComposerOpen}
        isSubmitting={isCreatingConversation}
        options={options}
        onClose={() => setIsComposerOpen(false)}
        onSubmit={createConversation}
      />

      <FilterSelectionModal
        description={
          activeFilterModal === 'connection'
            ? 'Escolha uma conexao ativa para refinar a lista de chats.'
            : 'Escolha um atendente para listar apenas as conversas assumidas por ele.'
        }
        isOpen={activeFilterModal !== null}
        items={filterModalItems}
        onClose={() => setActiveFilterModal(null)}
        onSelect={(id) => {
          if (activeFilterModal === 'connection') {
            setSelectedConnectionId(id);
            return;
          }

          setSelectedAssignedUserId(id);
        }}
        search={filterModalSearch}
        setSearch={setFilterModalSearch}
        title={activeFilterModal === 'connection' ? 'Selecionar WhatsApp' : 'Selecionar responsavel'}
      />

      <ContactRenameModal
        isOpen={isRenameModalOpen}
        initialName={contact?.nome || ''}
        subtitle={contact?.whatsapp || null}
        avatarUrl={contact?.avatar_url || null}
        loading={isRenamingContact}
        onClose={() => {
          if (!isRenamingContact) {
            setIsRenameModalOpen(false);
          }
        }}
        onConfirm={handleRenameContact}
      />

      <ConversationSettingsModal
        assignmentOptions={assignmentOptions}
        currentAssignedUserId={selectedConversation?.assigned_user_id || null}
        currentOwnerLabel={
          assignedUser?.nome_completo || 'Ninguém responsável no momento'
        }
        isOpen={isConversationSettingsOpen && Boolean(selectedConversation)}
        isSaving={isUpdatingAssignment}
        onApplyAssignment={handleUpdateAssignment}
        onClose={() => {
          if (!isUpdatingAssignment) {
            setIsConversationSettingsOpen(false);
          }
        }}
      />

      {isLoadingOptions ? <span className={styles.hiddenAssistive}>Carregando opções</span> : null}
    </motion.div>
  );
}
