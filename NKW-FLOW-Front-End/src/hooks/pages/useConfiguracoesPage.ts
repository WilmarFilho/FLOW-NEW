import { activeChatState, chatFiltersState } from '../../state/atom';
import { useState, useCallback, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

export function useConfiguracoesPage() {

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


  const tabs = ['Conta', 'Preferências'];

  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  return {
    activeTab,
    tabs,
    setActiveTab: handleTabChange,
  };
}