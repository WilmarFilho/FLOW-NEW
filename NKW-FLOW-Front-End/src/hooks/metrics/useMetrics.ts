import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { metricsState, userState } from '../../state/atom';
import { useApi } from '../utils/useApi';
import type { User } from '../../types/user';
import { ChatsMetricLabel, ChatsMetricResponse, ConnectionsMetric } from '../../types/metric';

export const useMetrics = () => {
  const [user] = useRecoilState(userState);
  const [metrics, setMetrics] = useRecoilState(metricsState);
  const { get } = useApi();

  const fetchMetrics = useCallback(async (userParam?: User) => {
    const currentUser = userParam ?? user;
    if (!currentUser) return;

    // Apenas admins podem buscar métricas
    if (currentUser.tipo_de_usuario !== 'admin') return;

    try {
      const params = { period: 'weekly' };

      const [novos, fechados, atendentes, conexoes] = await Promise.all([
        get<ChatsMetricResponse>('/metrics/chats/novos', { params }),
        get<ChatsMetricResponse>('/metrics/chats/fechados', { params }),
        get<ChatsMetricLabel[]>('/metrics/chats/atendentes', { params }),
        get<ConnectionsMetric[]>('/metrics/chats/conexoes', { params })
      ]);

      setMetrics({
        novos: novos || null,
        fechados: fechados || null,
        atendentes: atendentes || [],
        conexoes: conexoes || []
      });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setMetrics({
        novos: null,
        fechados: null,
        atendentes: [],
        conexoes: []
      });
    }
  }, [get, setMetrics, user]);

  return { metrics, fetchMetrics };
};