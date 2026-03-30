import { useRecoilValue, useSetRecoilState } from 'recoil';
import { activeChatState, chatFiltersState, metricsState } from '../../state/atom';
import { useEffect, useState } from 'react';
import { ViewType, DropdownId } from '../../components/Resumo/DropdownPeriod/DropdownPeriod';
import { useMetrics } from '../metrics/useMetrics';

export function useResumoPage() {

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


  const { fetchMetrics } = useMetrics();

  fetchMetrics();

  const metrics = useRecoilValue(metricsState);

  const [viewChatsNovos, setViewChatsNovos] = useState<ViewType>('weekly');
  const [viewChatsFechados, setViewChatsFechados] = useState<ViewType>('weekly');
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);

  const heightAtedentes = metrics ? metrics.atendentes.length * 50 : 0;
  const widthConexoes = Math.max(metrics ? metrics.conexoes.length * 120 : 0, 300);

  return {
    viewChatsNovos,
    setViewChatsNovos,
    viewChatsFechados,
    setViewChatsFechados,
    openDropdown,
    setOpenDropdown,
    dataNovos: metrics?.novos,
    dataFechados: metrics?.fechados,
    dataConexoes: metrics?.conexoes,
    dataAtendentes: metrics?.atendentes,
    heightAtedentes,
    widthConexoes,
  };
}