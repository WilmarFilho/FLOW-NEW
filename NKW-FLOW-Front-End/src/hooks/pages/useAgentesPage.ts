import { useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { activeChatState, agentsState, chatFiltersState, chatsState, connectionsState, ragStatusState } from '../../state/atom';
import { Agent } from '../../types/agent';

export function useAgentesPage() {

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

  // Carrega Conexões e Agentes
  const connections = useRecoilValue(connectionsState);
  const agents = useRecoilValue(agentsState);
  const ragStatus = useRecoilValue(ragStatusState);

  // Carrega Chats
  const chats = useRecoilValue(chatsState);

  // Controle de modal de detalhes do agente
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (agent: Agent | null) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedAgent(null);
    setIsModalOpen(false);
  };

  return {
    connections,
    agents,
    ragStatus,
    chats,
    selectedAgent,
    isModalOpen,
    openModal,
    closeModal,
  };
}

