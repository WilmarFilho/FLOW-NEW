'use client';

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

type FilterModalKind = 'assigned' | 'connection' | null;

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
    loadMoreConversations,
    loadOlderMessages,
    mobilePane,
    options,
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
    uploadMessageFile,
  } = useConversationsPage();
  const [draftMessage, setDraftMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<ConversationMessage | null>(null);
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeFilterModal, setActiveFilterModal] = useState<FilterModalKind>(null);
  const [filterModalSearch, setFilterModalSearch] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [, forceTick] = useState(0);
  const messagesRef = useRef<HTMLDivElement | null>(null);
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
  const selectedConnectionLabel =
    options?.connections.find((item) => item.id === selectedConnectionId)?.nome ||
    'Todos os WhatsApps';
  const selectedAssignedLabel =
    assignedUsers.find((item) => item.auth_id === selectedAssignedUserId)?.nome_completo ||
    'Todos os responsaveis';

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

  useEffect(() => {
    if (!messagesRef.current || preserveScrollRef.current || !initialScrollPendingRef.current || isLoadingMessages) {
      return;
    }

    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    initialScrollPendingRef.current = false;
  }, [groupedMessages.length, isLoadingMessages]);

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

    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
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

  const handleSendTextMessage = () => {
    const message = draftMessage.trim();
    if (!message) {
      return;
    }

    setDraftMessage('');
    const replyToMessageId = replyTarget?.id;
    setReplyTarget(null);
    shouldStickToBottomRef.current = true;
    void sendMessage(message, replyToMessageId);
  };

  const handleSelectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const caption = draftMessage.trim();
    const replyToMessageId = replyTarget?.id;

    setDraftMessage('');
    setReplyTarget(null);
    shouldStickToBottomRef.current = true;
    await uploadMessageFile(file, {
      caption: caption || undefined,
      replyToMessageId: replyToMessageId || undefined,
    });
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
    if (isRecordingAudio) {
      recorderRef.current?.stop();
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
      void uploadMessageFile(file, {
        caption: draftMessage.trim() || undefined,
        replyToMessageId: replyTarget?.id || undefined,
      });
      setDraftMessage('');
      setReplyTarget(null);
    });

    recorder.start();
    setIsRecordingAudio(true);
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
              </div>

              <div className={styles.composer}>
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
                    className={`${styles.iconButton} ${styles.composerActionButton}`}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={selectedConversation.ai_enabled || !manualReplyReady || isSendingMessage}
                    aria-label="Enviar arquivo"
                  >
                    <Paperclip size={17} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.composerActionButton} ${isRecordingAudio ? styles.iconButtonActive : ''}`}
                    onClick={() => void toggleAudioRecording()}
                    disabled={selectedConversation.ai_enabled || !manualReplyReady || isSendingMessage}
                    aria-label={isRecordingAudio ? 'Parar gravacao' : 'Gravar audio'}
                  >
                    <Mic size={17} />
                  </button>

                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder={
                      selectedConversation.ai_enabled
                        ? 'Desative a IA para responder manualmente'
                        : isRecordingAudio
                          ? 'Gravando audio... voce pode adicionar uma legenda'
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
                    onClick={handleSendTextMessage}
                  >
                    <Send size={18} />
                  </button>
                </div>
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

      {isLoadingOptions ? <span className={styles.hiddenAssistive}>Carregando opções</span> : null}
    </motion.div>
  );
}
