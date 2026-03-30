// Libs
import { useCallback } from 'react';
// Recoil
import { useSetRecoilState } from 'recoil';
import { chatsState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
// Types
import type { Chat } from '../../types/chats';

export default function useChatActions() {

  // Carrega metodo para modificar chats
  const setChats = useSetRecoilState(chatsState);

  // Carrega Metodos do hook da api
  const { del, put } = useApi();

  const deleteChat = async (chatId: string) => {

    const result = await del(`/chats/${chatId}`);

    if (result) {
      setChats((prev) => prev ? prev.filter((chat) => chat.id !== chatId) : []);
    }

    return result;

  };

  const renameChat = async (chatId: string, newName: string) => {

    const result = await put(`/chats/${chatId}`, { contato_nome: newName });

    if (result) {
      setChats((prev) =>
        prev ? prev.map((chat) => (chat.id === chatId ? { ...chat, contato_nome: newName } : chat)) : []
      );
    }

    return result;

  };

  const reOpenChat = async (chatId: string, status: 'Open' | 'Close') => {

    const result = await put(`/chats/${chatId}`, { status });

    if (result) {
      setChats((prev) =>
        prev ? prev.map((chat) => (chat.id === chatId ? { ...chat, status } : chat)) : []
      );
    }

    return result;

  };

  const toggleIA = useCallback(async (chatId: string, currentStatus: boolean) => {
    const body: Partial<Chat> = { ia_ativa: !currentStatus };

    if (currentStatus === true) {
      // IA estava ativa → agora vai desligar
      body.ia_desligada_em = new Date().toISOString();
    } else {
      // IA estava desativada → agora vai ativar
      body.ia_desligada_em = null;
      body.user_id = null; // limpar o dono do chat
    }

    const updated = await put<Chat>(`/chats/${chatId}`, body);

    return updated

  }, [put, setChats]);

  const claimChatOwner = async (chatId: string, userId: string) => {
    const result = await put(`/chats/${chatId}`, { user_id: userId });
    if (result) {
      setChats((prev) =>
        prev ? prev.map((chat) => (chat.id === chatId ? { ...chat, user_id: userId } : chat)) : []  
      );
    }
    return result;
  };

  async function releaseChatOwner(chatId: string) {
    const result = await put(`/chats/${chatId}`, { user_id: null });
    if (result) {
      setChats((prev) =>
        prev ? prev.map((chat) => (chat.id === chatId ? { ...chat, user_id: null } : chat)) : []
      );
    }
    return result;
  }

  return { deleteChat, renameChat, reOpenChat, toggleIA, claimChatOwner, releaseChatOwner };
}