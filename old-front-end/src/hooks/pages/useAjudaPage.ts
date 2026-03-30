import { useRecoilValue, useSetRecoilState } from 'recoil';
import { activeChatState, chatFiltersState, helpChatState } from '../../state/atom';
import { useHelpActions } from '../help/useHelpActions';
import { useEffect } from 'react';

export function useAjudaPage() {

  const setActiveChat = useSetRecoilState(activeChatState);
  const setFilters = useSetRecoilState(chatFiltersState);

  // resetar o chat ativo ao entrar na página
  useEffect(() => {
    setActiveChat(null);
    setFilters(prev => ({
      ...prev,
      isFetching: false,
    }));
  }, []);


  const messages = useRecoilValue(helpChatState);

  const { sendMessage, isSubmitting } = useHelpActions();

  return {
    isSubmitting,
    messages,
    sendMessage,
  };
}