// Libs
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
// Recoil
import { connectionsState, userState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
// Types
import type { Connection } from '../../types/connection';
import { User } from '../../types/user';

export const useConnections = () => {

  // Carrega Usuário
  const [user] = useRecoilState(userState)

  // Carrega Conexões
  const setConnections = useSetRecoilState(connectionsState);

  // Carrega Metodos do hook da api
  const { get } = useApi();

  const fetchConnections = useCallback(async (userParam?: User) => {
    const currentUser = userParam ?? user;
    if (!currentUser) return;
    if (currentUser.tipo_de_usuario !== 'admin') return;

    const fetchedData = await get<Connection[]>('/connections');

    if (fetchedData) {
      setConnections(fetchedData);
    }
  }, [get, setConnections, user]);


  return { fetchConnections };
};