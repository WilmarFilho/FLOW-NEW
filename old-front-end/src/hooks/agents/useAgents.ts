import { useRecoilState, useSetRecoilState } from 'recoil';
import { useCallback } from 'react';
import { agentsState, userState, ragStatusState } from '../../state/atom';
import { useApi } from '../utils/useApi';
import type { Agent, Rag } from '../../types/agent';
import { User } from '../../types/user';

type AgentsApiResponse = {
  agents: Agent[];
  rag_status: Rag;
};

export const useAgents = () => {
  const [user] = useRecoilState(userState);
  const setAgents = useSetRecoilState(agentsState);
  const setRagStatus = useSetRecoilState(ragStatusState);
  const { get } = useApi();

  const fetchAgents = useCallback(async (userParam?: User) => {
    const currentUser = userParam ?? user;
    if (!currentUser) return;

    if (currentUser.tipo_de_usuario !== 'admin') return;

    const fetchedData = await get<AgentsApiResponse>('/agents');

    if (fetchedData && Array.isArray(fetchedData.agents)) {
      setAgents(fetchedData.agents);
      setRagStatus(fetchedData.rag_status);
    }
  }, [get, user, setAgents, setRagStatus]);

  return { fetchAgents };
};