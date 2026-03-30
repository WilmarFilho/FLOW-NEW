import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { useChats } from '../chats/useChats';
import { useMessages } from '../../hooks/chats/useMessages';
import useMessagesActions from '../chats/useMessagesActions';
import useChatActions from '../chats/useChatActions';
import {
  activeChatState,
  attendantsState,
  chatsState,
  connectionsState,
  userState
} from '../../state/atom';
import { Message } from '../../types/message';

export function useConversasPage() {

  const [activeChat, setActiveChat] = useRecoilState(activeChatState);

  const connections = useRecoilValue(connectionsState);
  const chats = useRecoilValue(chatsState);
  const user = useRecoilValue(userState);
  const setChats = useSetRecoilState(chatsState);
  const attendants = useRecoilValue(attendantsState);

  const [replyingTo, setReplyingTo] = useState<Message | undefined>(undefined);
  const [isExiting, setIsExiting] = useState(false);

  const handleCloseReply = () => setIsExiting(true);

  useEffect(() => {
    if (!isExiting) return;
    const timer = setTimeout(() => {
      setReplyingTo(undefined);
      setIsExiting(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [isExiting]);

  const { fetchChats, fetchImageProfile, fetchMoreChats, hasMore: hasMoreChats, loading: isLoadingChats } = useChats();
  const { sendMessage, deleteMessage } = useMessagesActions();
  const { reOpenChat, deleteChat, renameChat, toggleIA, claimChatOwner, releaseChatOwner } = useChatActions();

  const { messages, fetchMoreMessages, hasMore, isLoading } = useMessages(activeChat?.id || null);
  
  const handleReleaseChatOwner = useCallback(async () => {
    if (!activeChat || !activeChat.user_id) return;
    const updated = await releaseChatOwner(activeChat.id);
    if (updated) setActiveChat(prev => prev ? { ...prev, user_id: null } : prev);
  }, [activeChat, releaseChatOwner]);

  // Estado e funções para criar novo chat
  const [isAddChatOpen, setIsAddChatOpen] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [filterConnectionId, setFilterConnectionId] = useState<string | null>(null);
  const [formConnectionId, setFormConnectionId] = useState<string | null>(null);
  const [selectedAttendantId, setSelectedAttendantId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<{ selectedConnectionId?: string; newChatNumber?: string; newChatMessage?: string }>({});

  const openNewChatModal = () => {
    setNewChatNumber('');
    setNewChatMessage('');
    setShowErrors(false);
    setIsAddChatOpen(true);
  };

  const validateForm = useCallback(() => {
    const newErrors: typeof errors = {};
    if (!formConnectionId) newErrors.selectedConnectionId = 'Selecione uma conexão.';
    if (!/^\d{10,15}$/.test(newChatNumber)) newErrors.newChatNumber = 'Número inválido.';
    if (!newChatMessage.trim()) newErrors.newChatMessage = 'A mensagem não pode ficar vazia.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formConnectionId, newChatNumber, newChatMessage]);

  const handleSendMessage = useCallback(async (text?: string, mimetype?: string, base64?: string) => {
    setIsSubmitting(true);
    try {
      const messageText = text ?? newChatMessage;

      if (isAddChatOpen) {
        if (!formConnectionId) {
          setErrors({ selectedConnectionId: 'Selecione uma conexão.' });
          return;
        }

        const result = await sendMessage({
          mensagem: newChatMessage,
          number: newChatNumber,
          connection_id: formConnectionId
        });

        if (result) {
          setIsAddChatOpen(false);
          setNewChatNumber('');
          setNewChatMessage('');
          setFormConnectionId(null);
        }
        return;
      }

      if (activeChat && activeChat.ia_ativa) {
        alert('⚠️ Não é possível enviar mensagem enquanto a IA está ativa.');
        return;
      }

      const cooldownMin = 1;
      if (activeChat && activeChat.ia_desligada_em) {
        let iso = activeChat.ia_desligada_em;
        if (!iso.endsWith('Z') && !iso.includes('+')) iso += 'Z';
        const desligadaEm = new Date(iso).getTime();
        if (Date.now() - desligadaEm < cooldownMin * 60 * 1000) {
          alert('⚠️ Aguarde alguns minutos antes de assumir o chat após desligar a IA.');
          return;
        }
      }

      const result = await sendMessage({
        chat_id: activeChat?.id,
        mensagem: messageText,
        user_id: user?.id,
        mimetype,
        base64,
        quote_id: replyingTo?.id
      });

      if (result && activeChat) {
        if (!activeChat?.user_id && user?.id) {
          await claimChatOwner(activeChat.id, user.id);
          setActiveChat(prev => prev ? { ...prev, user_id: user.id } : prev);
        }
        if (replyingTo) {
          setIsExiting(true);
          setTimeout(() => {
            setReplyingTo(undefined);
            setIsExiting(false);
          }, 900);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [activeChat, newChatMessage, newChatNumber, sendMessage, setChats, user?.id, replyingTo]);

  const handleCreateChat = useCallback(async () => {
    setShowErrors(true);
    if (!validateForm()) return;

    await handleSendMessage();
  }, [validateForm, handleSendMessage]);

  const handleToggleIA = useCallback(async () => {
    if (!activeChat) return;
    const updated = await toggleIA(activeChat.id, activeChat.ia_ativa);
    if (!updated) return;

    setActiveChat(prev => prev ? {
      ...prev,
      ia_ativa: updated.ia_ativa,
      ia_desligada_em: updated.ia_desligada_em,
      user_id: updated.user_id ?? prev.user_id
    } : prev);

    setChats(prev => (prev ?? []).map(c => c.id === updated.id ? {
      ...c,
      ia_ativa: updated.ia_ativa,
      ia_desligada_em: updated.ia_desligada_em,
      user_id: updated.user_id
    } : c));
  }, [activeChat, toggleIA, setChats]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null!);

  const handleDeleteChat = useCallback(async () => {
    if (!activeChat) return;
    await deleteChat(activeChat.id);
    setActiveChat(null);
    setIsDeleteDialogOpen(false);
  }, [activeChat, deleteChat]);

  const handleToggleChatStatus = useCallback(async () => {
    if (!activeChat) return;
    const newStatus = activeChat.status === 'Open' ? 'Close' : 'Open';

    if (newStatus === 'Close' && (activeChat.ia_ativa || !activeChat.user_id || activeChat.user_id !== user?.id)) {
      let message = 'Não é possível fechar este chat devido a:';
      if (activeChat.ia_ativa) message += '\n- A IA ainda está ativa';
      if (!activeChat.user_id) message += '\n- Nenhum atendente assumiu a conversa';
      else if (activeChat.user_id !== user?.id) message += '\n- Outro atendente está assumindo essa conversa';
      alert(message);
      return;
    }

    const result = await reOpenChat(activeChat.id, newStatus);
    if (result) {
      const updatedChat = { ...activeChat, status: newStatus as 'Open' | 'Close' };
      setActiveChat(updatedChat);
      setChats(prev => (prev ?? []).map(chat => chat.id === updatedChat.id ? { ...chat, status: newStatus as 'Open' | 'Close' } : chat));
    }
  }, [activeChat, reOpenChat, setChats, user?.id]);

  const handleRenameChat = useCallback((newName: string) => {
    if (!activeChat || !newName.trim()) return;
    setIsSubmitting(true);
    renameChat(activeChat.id, newName.trim())
      .finally(() => setIsSubmitting(false));
    setActiveChat({ ...activeChat, contato_nome: newName.trim() });
  }, [activeChat, renameChat]);

  const handleFileDrop = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const messageText = file.type.startsWith('image/') ? '' : file.name;
      handleSendMessage(messageText, file.type, base64);
    };
    reader.readAsDataURL(file);
  }, [handleSendMessage]);

  return {
    isSubmitting,
    user,
    chats,
    attendants,
    connections,
    activeChat,
    setActiveChat,
    messages,
    fetchMoreMessages,
    hasMore,
    isLoading,
    fetchImageProfile,
    fetchChats,
    fetchMoreChats,
    hasMoreChats,
    isLoadingChats,
    replyingTo,
    handleSetReplyingTo: setReplyingTo,
    handleCloseReply,
    handleCreateChat,
    isExiting,
    setIsExiting,
    isAddChatOpen,
    setIsAddChatOpen,
    openNewChatModal,
    newChatNumber,
    setNewChatNumber,
    newChatMessage,
    setNewChatMessage,
    formConnectionId,
    setFormConnectionId,
    selectedAttendantId,
    setSelectedAttendantId,
    filterConnectionId,
    setFilterConnectionId,
    showErrors,
    errors,
    handleSendMessage,
    handleToggleIA,
    handleDeleteChat,
    handleToggleChatStatus,
    handleRenameChat,
    handleDropFile: handleFileDrop,
    handleDeleteMessage: deleteMessage,
    handleReleaseChatOwner,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    cancelRef,
  };

}