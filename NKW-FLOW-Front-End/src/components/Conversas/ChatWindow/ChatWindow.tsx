import { useState, useRef, useEffect } from 'react';
import { Chat } from '../../../types/chats';
import { Message } from '../../../types/message';
import { useDragAndDropFile } from '../../../hooks/utils/useDragAndDropFile';
import MessageBubble from '../MessageBubble/MessageBubble';
import ChatInput from '../../Gerais/Inputs/ChatInput';
import Modal from '../../Gerais/Modal/Modal';
import ToggleSwitch from '../../Configuracoes/ToggleSwitch/ToggleSwitch';
import Icon from '../../Gerais/Icons/Icons';
import defaultAvatar from '../assets/default.webp';
import styles from './ChatWindow.module.css';
import FormStyles from '../../Gerais/Form/form.module.css';
import { DropdownMenu } from '../../../components/Gerais/Dropdown/DropdownMenu';
import { useRecoilValue } from 'recoil';
import { userState } from '../../../state/atom';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { useInfiniteScroll } from '../../../hooks/utils/useInfiniteScroll';

interface ChatWindowProps {
  isSubmitting: boolean;
  activeChat: Chat | null;
  messages: Message[];
  handleSendMessage: (text?: string, mimetype?: string, base64?: string) => void;
  handleToggleIA: () => void;
  handleDeleteChat: () => void;
  handleToggleChatStatus: () => void;
  handleRenameChat: (newName: string) => void;
  handleDropFile: (file: File) => void;
  handleSetReplyingTo: (msg: Message | undefined) => void;
  replyingTo: Message | undefined;
  isExiting: boolean;
  setIsExiting: React.Dispatch<React.SetStateAction<boolean>>;
  handleCloseReply: () => void;
  handleDeleteMessage: (id: string) => void;
  fetchMoreMessages: () => void;
  hasMore: boolean;
  isLoading: boolean;
  isMobileLayout: boolean;
  onBack?: () => void;
  handleReleaseChatOwner: () => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cancelRef: React.RefObject<HTMLButtonElement>;
}

export default function ChatWindow({
  isDeleteDialogOpen,
  isSubmitting,
  fetchMoreMessages,
  cancelRef,
  setIsDeleteDialogOpen,
  hasMore,
  isLoading,
  activeChat,
  messages,
  handleSendMessage,
  handleToggleIA,
  handleDeleteChat,
  handleToggleChatStatus,
  handleRenameChat,
  handleDropFile,
  handleSetReplyingTo,
  replyingTo,
  isExiting,
  handleDeleteMessage,
  handleCloseReply,
  isMobileLayout,
  handleReleaseChatOwner,
  onBack,
}: ChatWindowProps) {
  const [isDeleteMessageOpen, setIsDeleteMessageOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const cancelDeleteMsgRef = useRef<HTMLButtonElement>(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [showError, setShowError] = useState(false);

  const user = useRecoilValue(userState);
  const isOwner = !activeChat?.user_id || activeChat?.user_id === user?.id;

  const inputRef = useRef<HTMLInputElement>(null);
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragAndDropFile({ handleDropFile });
  const chatId = activeChat?.id

  const { listRef, topSentinelRef } = useInfiniteScroll({
    activeChat,
    fetchMoreMessages,
    hasMore,
    isLoading,
    messages,
    chatId
  });

  // Resposta de mensagem
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [replyingTo]);

  useEffect(() => handleSetReplyingTo(undefined), [activeChat]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && replyingTo) handleCloseReply();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replyingTo, handleCloseReply]);

  const openDeleteMessageDialog = (id: string) => {
    setMessageToDelete(id);
    setIsDeleteMessageOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    try {
      await handleDeleteMessage?.(messageToDelete);
    } finally {
      setIsDeleteMessageOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleRenameClick = () => {
    if (!newName.trim()) {
      setShowError(true);
      return;
    }
    setShowError(false);
    handleRenameChat(newName.trim());
    setRenameOpen(false);
  };

  if (!activeChat) {
    return (
      <div className={styles.fallbackContainer}>
        <p>Selecione uma conversa para começar.</p>
      </div>
    );
  }

  // Agrupamento de mensagens
  const groupedMessages: React.ReactNode[] = [];
  let lastDate: string | null = null;

  const parseToLocalDate = (utcTimestamp: string): Date => {
    if (utcTimestamp && !utcTimestamp.endsWith('Z')) {
      const isoString = utcTimestamp.replace(' ', 'T') + 'Z';
      return new Date(isoString);
    }
    return new Date(utcTimestamp);
  };

  const uniqueMessages = Array.from(new Map(messages.map((m) => [m.id, m])).values());

  uniqueMessages.forEach((msg) => {
    const localMsgDate = parseToLocalDate(msg.criado_em);
    const msgDateKey = localMsgDate.toDateString();

    if (msgDateKey !== lastDate) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let displayDate = '';
      if (msgDateKey === today) displayDate = 'Hoje';
      else if (msgDateKey === yesterday) displayDate = 'Ontem';
      else
        displayDate = localMsgDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

      groupedMessages.push(
        <div key={`divider-${msgDateKey}`} className={styles.dateDivider}>
          <span>{displayDate}</span>
        </div>
      );
      lastDate = msgDateKey;
    }

    groupedMessages.push(
      <MessageBubble
        key={msg.id}
        id={msg.id}
        avatarUrl={activeChat.foto_perfil}
        senderName={activeChat.contato_nome}
        text={msg.mensagem}
        mimetype={msg.mimetype}
        filename={msg.file_name}
        base64={msg.base64}
        sender={msg.remetente === 'Usuário' ? 'me' : 'other'}
        createdAt={msg.criado_em}
        excluded={msg.excluded}
        quote={
          msg.quote_message
            ? {
              mensagem: msg.quote_message.mensagem,
              mimetype: msg.quote_message.mimetype,
              remetente: msg.quote_message.remetente as 'Usuário' | 'Contato' | 'IA',
            }
            : undefined
        }
        onReply={() => handleSetReplyingTo(msg)}
        onDelete={openDeleteMessageDialog}
        isMobileLayout={isMobileLayout}
      />
    );
  });

  return (
    <section
      className={styles.chatWindow}
    >
      {/* Header MOBILE (<= 991.98px) */}
      {isMobileLayout && (
        <header className={styles.chatHeader}>

          <div
            className={styles.contactInfo}
            onClick={() => setDetailsOpen(true)}
            style={{ cursor: 'pointer' }}
          >
            <img
              src={activeChat.foto_perfil || defaultAvatar}
              alt={`Avatar de ${activeChat.contato_nome}`}
            />
            <div className={styles.contactText}>
              <h1 title={activeChat.contato_nome}>{activeChat.contato_nome}</h1>
            </div>
          </div>

          {onBack ? (
            <button
              className={styles.backButton}
              onClick={onBack}
              aria-label='Voltar para a lista de chats'
            >
              <Icon nome='arrow' />
            </button>
          ) : (
            ''
          )}

          <DropdownMenu
            id='chat-header'
            trigger={
              <button className={styles.optionsButton}>
                <Icon nome='dots' />
              </button>
            }
          >

            {user?.plano !== 'basico' && (
              <div className={styles.toggleIaButton}>
                <div className={styles.headerToggleIa}>
                  <Icon nome="agentespage" /> {activeChat.ia_ativa ? 'Ativado' : 'Desativado'}
                </div>

                <ToggleSwitch
                  variant="secondary"
                  isOn={activeChat.ia_ativa}
                  onToggle={handleToggleIA}
                />
              </div>
            )}

            {isOwner && (
              <>
                <button
                  onClick={() => {
                    setNewName(activeChat.contato_nome || '');
                    setRenameOpen(true);
                  }}
                >
                  <Icon nome='pencil' /> Renomear Chat
                </button>


                {activeChat.user_id === user?.id && (
                  <>
                    <button onClick={handleReleaseChatOwner}>
                      <Icon nome='unlock' /> Liberar Chat
                    </button>
                    <button onClick={handleToggleChatStatus}>
                      <Icon nome='close' />{' '}
                      {activeChat.status === 'Open' ? 'Fechar Chat' : 'Reabrir Chat'}
                    </button>
                    <button onClick={() => setIsDeleteDialogOpen(true)}>
                      <Icon nome='trash' /> Apagar Chat
                    </button>
                  </>
                )}

              </>
            )}
            <button onClick={() => setDetailsOpen(true)}>
              <Icon nome='info' /> Detalhes do Chat
            </button>
          </DropdownMenu>


        </header>
      )
      }

      {/* Header DESKTOP/TABLET (> 991.98px) */}
      {
        !isMobileLayout && (
          <header className={styles.chatHeader}>
            <div
              className={styles.contactInfo}
              onClick={() => setDetailsOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <img
                src={activeChat.foto_perfil || defaultAvatar}
                alt={`Avatar de ${activeChat.contato_nome}`}
              />
              <div className={styles.contactText}>
                <h1>{activeChat.contato_nome}</h1>
              </div>
            </div>

            {activeChat.user_id === user?.id && (
              <div className={styles.ownerBadge}>
                <Icon nome='userlist' /> SEU CHAT
              </div>
            )}


            <DropdownMenu
              id='chat-header'
              trigger={
                <button className={styles.optionsButton}>
                  <Icon nome='dots' />
                </button>
              }
            >
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      setNewName(activeChat.contato_nome || '');
                      setRenameOpen(true);
                    }}
                  >
                    <Icon nome='pencil' /> Renomear Chat
                  </button>


                  {activeChat.user_id === user?.id && (
                    <>
                      <button onClick={handleReleaseChatOwner}>
                        <Icon nome='unlock' /> Liberar Chat
                      </button>
                      <button onClick={handleToggleChatStatus}>
                        <Icon nome='close' />{' '}
                        {activeChat.status === 'Open' ? 'Fechar Chat' : 'Reabrir Chat'}
                      </button>
                      <button onClick={() => setIsDeleteDialogOpen(true)}>
                        <Icon nome='trash' /> Apagar Chat
                      </button>
                    </>
                  )}

                </>
              )}
              <button onClick={() => setDetailsOpen(true)}>
                <Icon nome='info' /> Detalhes do Chat
              </button>
            </DropdownMenu>
          </header>
        )
      }

      <Modal transparent isOpen={isDetailsOpen} onClose={() => setDetailsOpen(false)} title='Detalhes do Chat'>
        <div className={styles.chatDetails}>

          <div className={styles.detailsRow}>

            <img src={activeChat.foto_perfil || defaultAvatar} alt={`Avatar de ${activeChat.contato_nome}`} />

            <div className={`${styles.detailsColumn} ${styles.detailsColumnMobile}`}>
              <p>Nome</p>
              <span>{activeChat.contato_nome ?? '------'}</span>
            </div>

            <div className={styles.detailsColumn}>
              <p>Número</p>
              <span>{activeChat.contato_numero ?? '------'}</span>
            </div>
          </div>

          <div className={styles.detailsRow}>
            <div className={styles.detailsColumn}>
              <p>Criado em</p>
              <span>
                {(() => {
                  const date = new Date(activeChat.ultima_atualizacao);
                  const dia = date.toLocaleDateString('pt-BR', { day: '2-digit' });
                  const mes = date.toLocaleDateString('pt-BR', { month: 'long' });
                  return `${dia} de ${mes}`;
                })()}
              </span>
            </div>

            <div className={styles.detailsColumn}>
              <p>Status</p>
              <span>{activeChat.status === 'Open' ? 'Aberto' : 'Fechado'}</span>
            </div>
          </div>

          <div className={styles.detailsRow}>
            <div className={styles.detailsColumn}>
              <p>IA</p>
              <span>{activeChat.ia_ativa ? 'Ativada' : 'Desativada'}</span>
            </div>

            <div className={styles.detailsColumn}>
              <p>Atendente Responsável</p>
              <span>{activeChat.user_nome ?? '------'}</span>
            </div>
          </div>

        </div>
      </Modal>

      <Modal
        isSubmitting={isSubmitting}
        onSave={handleRenameClick}
        labelSubmit='Salvar'
        transparent
        isOpen={isRenameOpen}
        onClose={() => setRenameOpen(false)}
        title='Renomear Chat'
      >
        <div className={FormStyles.formGroup}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='Novo nome'
          />
          {showError && !newName.trim() && (
            <span className={FormStyles.errorText}>O nome não pode ficar vazio.</span>
          )}
        </div>
      </Modal>

      {
        isDragging && (
          <div className={styles.dragOverlay}>
            <p>📄 Solte o arquivo para enviar</p>
          </div>
        )
      }


      <div

        className={styles.messageList}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}

      >
        <div className={styles.teste} ref={listRef} id={`chat-list-${activeChat.id}`}>
          <div ref={topSentinelRef} className={styles.sentinel} style={{ visibility: 'hidden', height: 1 }} >.</div>

          {groupedMessages}

        </div>


      </div>

      <div className={styles.inputAreaWrapper}>
        {isOwner ? (
          activeChat.status === 'Open' ? (
            <>
              {replyingTo && (
                <div className={`${styles.replyPreview} ${isExiting ? styles.isExiting : ''}`}>
                  <div>
                    <span>{replyingTo.remetente === 'Usuário' ? 'Você' : activeChat.contato_nome}</span>
                    <p>
                      {replyingTo.mensagem ||
                        (replyingTo.mimetype?.startsWith('image/')
                          ? '📷 Foto'
                          : 'Mensagem de áudio')}
                    </p>
                    <button onClick={handleCloseReply}>✖</button>
                  </div>
                </div>
              )}

              <div className={styles.inputArea}>

                {!isMobileLayout && user?.plano !== 'basico' && (
                  <div className={styles.toggleIaButton}>
                    <div className={styles.headerToggleIa}>
                      <Icon nome='agentespage' /> {activeChat.ia_ativa ? 'Ativado' : 'Desativado'}
                    </div>

                    <ToggleSwitch
                      variant="secondary"
                      isOn={activeChat.ia_ativa}
                      onToggle={handleToggleIA}
                    />
                  </div>
                )}


                <ChatInput
                  ref={inputRef}
                  placeholder='Digite uma mensagem'
                  onSend={(text, mimetype, base64) => handleSendMessage(text, mimetype, base64)}
                />

              </div>
            </>
          ) : (
            <div className={styles.chatClosedBanner}>
              <button className={styles.buttonReOpen} onClick={handleToggleChatStatus}>
                Reabrir Chat
              </button>
            </div>
          )
        ) : (
          <div className={styles.chatClosedBanner}>
            <button className={styles.buttonReOpen} onClick={handleToggleChatStatus}>
              Chat em andamento por: {activeChat.user_nome}
            </button>
          </div>
        )}
      </div>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteDialogOpen(false)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent className={styles.customDialog}>
            <AlertDialogHeader fontSize='lg' fontWeight='bold'>
              Excluir Conversa
            </AlertDialogHeader>
            <AlertDialogBody>
              Você tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className={styles.actionAlert} onClick={handleDeleteChat} ml={3}>
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog
        isOpen={isDeleteMessageOpen}
        leastDestructiveRef={cancelDeleteMsgRef}
        onClose={() => setIsDeleteMessageOpen(false)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent className={styles.customDialog}>
            <AlertDialogHeader fontSize='lg' fontWeight='bold'>
              Excluir Mensagem
            </AlertDialogHeader>
            <AlertDialogBody>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelDeleteMsgRef} onClick={() => setIsDeleteMessageOpen(false)}>
                Cancelar
              </Button>
              <Button className={styles.actionAlert} colorScheme='red' onClick={confirmDeleteMessage} ml={3}>
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

    </section >

  );
}