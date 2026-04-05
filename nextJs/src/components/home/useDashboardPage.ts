'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiRequest } from '@/lib/api/client';
import { supabase } from '@/lib/supabaseClient';

export type RangeOption = '7d' | '30d' | '90d';
export type ChartSeriesKey = 'campaigns' | 'chats' | 'contacts' | 'messages';

type MetricSnapshot = {
  current: number;
  delta: number | null;
  direction: 'down' | 'flat' | 'up';
  previous: number;
};

export interface DashboardData {
  generatedAt: string;
  range: RangeOption;
  scope: 'restricted' | 'workspace';
  summary: {
    activeChats: number;
    aiActiveChats: number;
    appointmentsThisWeek: number;
    archivedChats: number;
    campaignsCreated: MetricSnapshot;
    chatsStarted: MetricSnapshot;
    completedCampaigns: number;
    confirmedAppointmentsThisWeek: number;
    humanAttentionChats: number;
    messageVolume: MetricSnapshot;
    newContacts: MetricSnapshot;
    runningCampaigns: number;
  };
  timeline: Array<{
    campaigns: number;
    chats: number;
    contacts: number;
    key: string;
    label: string;
    messages: number;
  }>;
  chatsByUser: Array<{
    count: number;
    id: string;
    name: string;
  }>;
  campaignsByStatus: Array<{
    count: number;
    status: string;
  }>;
  appointmentsByWeekday: Array<{
    cancelled: number;
    confirmed: number;
    key: string;
    label: string;
    pending: number;
    total: number;
  }>;
  channelPerformance: Array<{
    campaigns: number;
    chats: number;
    id: string;
    messages: number;
    name: string;
    status: string;
  }>;
  recentCampaigns: Array<{
    created_at: string;
    id: string;
    nome: string;
    progress: number;
    status: string;
    total_contatos: number;
  }>;
  topConnections: Array<{
    accent: string;
    campaigns: number;
    chats: number;
    id: string;
    messages: number;
    name: string;
    status: string;
  }>;
  highlights: {
    connectionCount: number;
    inboundMessages: number;
    outboundMessages: number;
  };
}

const fetchDashboard = async (userId: string, range: RangeOption) =>
  apiRequest<DashboardData>(`/dashboard?range=${range}`, { userId });

export function useDashboardPage() {
  const [userId, setUserId] = useState('');
  const [range, setRange] = useState<RangeOption>('30d');
  const [activeSeries, setActiveSeries] = useState<ChartSeriesKey[]>([
    'chats',
    'messages',
  ]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['dashboard', userId, range] : null,
    ([, id, selectedRange]) =>
      fetchDashboard(id as string, selectedRange as RangeOption),
    {
      revalidateOnFocus: false,
    },
  );

  const headlineCards = useMemo(
    () =>
      data
        ? [
            {
              accent: 'blue',
              label: 'Chats iniciados',
              metric: data.summary.chatsStarted,
              value: data.summary.chatsStarted.current,
            },
            {
              accent: 'gold',
              label: 'Mensagens trafegadas',
              metric: data.summary.messageVolume,
              value: data.summary.messageVolume.current,
            },
            {
              accent: 'green',
              label: 'Contatos novos',
              metric: data.summary.newContacts,
              value: data.summary.newContacts.current,
            },
            {
              accent: 'ice',
              label: 'Campanhas criadas',
              metric: data.summary.campaignsCreated,
              value: data.summary.campaignsCreated.current,
            },
          ]
        : [],
    [data],
  );

  return {
    activeSeries,
    data,
    error,
    headlineCards,
    isLoading: isLoading || !userId,
    mutate,
    range,
    setActiveSeries,
    setRange,
    userId,
  };
}
