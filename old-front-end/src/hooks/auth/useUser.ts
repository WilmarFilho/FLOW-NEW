// Libs
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
// Recoil
import { userState, authTokenState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
// Types
import type { User } from '../../types/user';
// Modelos do Usuário
import { useAttendants } from '../attendants/useAttendants';
import { useAgents } from '../agents/useAgents';
import { useConnections } from '../connections/useConnections';
import { useChats } from '../chats/useChats';

export const useUser = () => {

  // Carrega Usuário
  const [user, setUser] = useRecoilState(userState);

  // Carrega todos fetch dos modelos do Usuário
  const { fetchAttendants } = useAttendants();
  const { fetchAgents } = useAgents();
  const { fetchChats } = useChats();
  const { fetchConnections } = useConnections();

  // Carrega Metodos do hook da api
  const { get } = useApi();

  // Auth
  const [token] = useRecoilState(authTokenState);

  const fetchUser = useCallback(
    async (opts?: { force?: boolean; onProgress?: (msg: string) => void }) => {
      if (!token?.token || !token.userId) return null;
      if (!opts?.force && user) return user;

      const fetchedUser = await get<User>('/users');

      if (fetchedUser) {
        setUser(fetchedUser);

        console.log(fetchedUser)
       
        opts?.onProgress?.('Carregando conversas ...');
        await fetchChats(
          {
            search: null,
            connection_id: null,
            attendant_id: null,
            iaStatus: 'todos',
            status: 'Open',
            owner: 'all',
            isFetching: false,
          },
          fetchedUser
        );

        opts?.onProgress?.('Carregando atendentes ...');
        await fetchAttendants(fetchedUser);

        opts?.onProgress?.('Carregando agentes ...');
        await fetchAgents(fetchedUser);

        opts?.onProgress?.('Carregando conexões ...');
        await fetchConnections(fetchedUser);

      }

      return fetchedUser;
    },
    [token, user, setUser, get]
  );

  return { fetchUser };
}