import { activeChatState, chatFiltersState, userState } from '../../state/atom';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export function useRecompensasPage() {

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


  const user = useRecoilValue(userState)

  const rewards = useMemo(
    () => [
      { tier: 1, name: 'Novato', goal: 2, casbackPercentual: 5 },
      { tier: 2, name: 'Engajado', goal: 4, casbackPercentual: 15 },
      { tier: 3, name: 'Influenciador', goal: 10, casbackPercentual: 25 },
      {
        tier: 4,
        name: 'Lenda do FLOW',
        goal: 25,
        casbackPercentual: 40,
       
      }
    ],
    []
  );

  const totalIndicacoes = user?.referrals_count || 0;

  const progresso = useMemo(
    () =>
      Math.min(
        (totalIndicacoes / rewards[rewards.length - 1].goal) * 100,
        100
      ),
    [totalIndicacoes, rewards]
  );

  const [link] = useState('https://nkwflow.com/ref/seu-link');

  const copiarLink = useCallback(() => {
    navigator.clipboard.writeText(link);
    alert('Link copiado!');
  }, [link]);

  return {
    rewards,
    totalIndicacoes,
    progresso,
    link,
    copiarLink
  };
}