// Libs
import { useCallback } from 'react';
// Recoil
import { useRecoilState, useSetRecoilState } from 'recoil';
import { addConnectionModalState, connectionsState, userState } from '../../state/atom';
// Hooks
import { useApi } from '../utils/useApi';
import { useConnections } from './useConnections';
// Types
import { Connection } from '../../types/connection';
import { useAttendants } from '../attendants/useAttendants';

export const useConnectionsActions = () => {

  // Carrega conexões e seus Métodos
  const [connections, setConnections] = useRecoilState(connectionsState);
  const { fetchConnections } = useConnections();
  const { fetchAttendants } = useAttendants();

  // Recoil
  const [user] = useRecoilState(userState);
  const setModalState = useSetRecoilState(addConnectionModalState);

  // Carrega Metodos do hook da api
  const { post, put, del } = useApi();

  const handleStartSession = async (connection: Partial<Connection>) => {
    if (!user) return;

    setModalState((prev) => ({ ...prev, isLoading: true }));

    console.log(connection)

    try {
      const qrcode = await post<{ base64: string | null, pairingCode: string | null }>('/connections', {
        nome: connection.nome,
        agente_id: connection.agente_id,
        numero: connection.numero || null,
      });

      if (qrcode) {
        setModalState((prev) => ({ ...prev, qrCode: qrcode.base64, pairingCode: qrcode.pairingCode, step: 3 }));
      } else {
        setModalState((prev) => ({ ...prev, qrCode: null, step: 1, isOpen: false }));
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setModalState((prev) => ({ ...prev, qrCode: null, step: 1, isOpen: false }));
    }
  };

  const handleEditConnection = async (connection: Partial<Connection>) => {

    if (!user) return;

    setModalState((prev) => ({ ...prev, isLoading: true }));

    const result = await put<Connection>(`/connections/${connection.id}`, {
      nome: connection.nome,
      agente_id: connection.agente_id,
    });

    if (result) {
      fetchConnections();
    }

  };

  const removeConnection = useCallback(async (id: string) => {

    if (!user) return;

    const result = await del(`/connections/${id}`);

    if (result) {
      fetchConnections();
      fetchAttendants();
    }

  }, [del, setConnections]);

  const updateConnectionStatus = useCallback(async (connection: Connection) => {

    if (!user) return;

    const result = await put<Connection>(`/connections/${connection.id}`, {
      nome: connection.nome,
      agente_id: connection.agente_id,
      status: !connection.status,
    });

    if (result) {
      fetchConnections();
    }

  }, [put, setConnections]);

  return {
    connections,
    setConnections,
    handleStartSession,
    handleEditConnection,
    removeConnection,
    updateConnectionStatus,
  };
};
