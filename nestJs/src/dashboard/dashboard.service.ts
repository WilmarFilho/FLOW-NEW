/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

type RangeOption = '7d' | '30d' | '90d';

type AccessContext = {
  allowedConnectionIds: string[] | null;
  effectiveProfileId: string;
  isAtendente: boolean;
};

type TimelineBucket = {
  campaigns: number;
  chats: number;
  contacts: number;
  end: Date;
  key: string;
  label: string;
  messages: number;
  start: Date;
};

type MetricSnapshot = {
  current: number;
  delta: number | null;
  direction: 'down' | 'flat' | 'up';
  previous: number;
};

type ConversationRow = {
  ai_enabled: boolean;
  assigned_user_id: string | null;
  created_at: string;
  human_intervention_requested_at: string | null;
  id: string;
  status: 'open' | 'archived';
  whatsapp_connection_id: string;
};

type MessageRow = {
  created_at: string;
  direction: 'inbound' | 'outbound' | 'system';
  whatsapp_connection_id: string;
};

type CampaignRow = {
  created_at: string;
  falhas: number;
  id: string;
  nome: string;
  pendentes: number;
  status: 'draft' | 'running' | 'completed' | 'failed';
  total_contatos: number;
  enviados_com_sucesso: number;
  whatsapp_connection_id: string;
};

type ContactRow = {
  created_at: string;
  id: string;
};

type AppointmentRow = {
  data_hora: string;
  id: string;
  status: 'cancelado' | 'confirmado' | 'pendente';
};

type ConnectionRow = {
  id: string;
  nome: string;
  status: 'connected' | 'connecting' | 'disconnected';
};

@Injectable()
export class DashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getDashboard(userId: string, rawRange?: string) {
    const access = await this.getAccessContext(userId);
    const range = this.normalizeRange(rawRange);
    const timeline = this.createTimelineBuckets(range);
    const currentStart = timeline[0]?.start ?? new Date();
    const previousStart = this.shiftDate(
      currentStart,
      -(timeline[timeline.length - 1]?.end.getTime() - currentStart.getTime()),
    );
    const now = new Date();
    const previousStartIso = previousStart.toISOString();
    const nowIso = now.toISOString();

    const contactsScopeIds =
      access.allowedConnectionIds === null
        ? null
        : await this.getScopedContactIds(
            access.effectiveProfileId,
            access.allowedConnectionIds,
          );

    const [
      conversations,
      messages,
      campaigns,
      contacts,
      appointments,
      connections,
    ] = await Promise.all([
      this.fetchConversations(
        access.effectiveProfileId,
        previousStartIso,
        access.allowedConnectionIds,
      ),
      this.fetchMessages(
        access.effectiveProfileId,
        previousStartIso,
        access.allowedConnectionIds,
      ),
      this.fetchCampaigns(
        access.effectiveProfileId,
        previousStartIso,
        access.allowedConnectionIds,
      ),
      this.fetchContacts(
        access.effectiveProfileId,
        previousStartIso,
        contactsScopeIds,
      ),
      this.fetchAppointments(access.effectiveProfileId),
      this.fetchConnections(
        access.effectiveProfileId,
        access.allowedConnectionIds,
      ),
    ]);

    const currentConversations = conversations.filter(
      (item) => new Date(item.created_at).getTime() >= currentStart.getTime(),
    );
    const previousConversations = conversations.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return (
        createdAt >= previousStart.getTime() &&
        createdAt < currentStart.getTime()
      );
    });

    const currentMessages = messages.filter(
      (item) => new Date(item.created_at).getTime() >= currentStart.getTime(),
    );
    const previousMessages = messages.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return (
        createdAt >= previousStart.getTime() &&
        createdAt < currentStart.getTime()
      );
    });

    const currentCampaigns = campaigns.filter(
      (item) => new Date(item.created_at).getTime() >= currentStart.getTime(),
    );
    const previousCampaigns = campaigns.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return (
        createdAt >= previousStart.getTime() &&
        createdAt < currentStart.getTime()
      );
    });

    const currentContacts = contacts.filter(
      (item) => new Date(item.created_at).getTime() >= currentStart.getTime(),
    );
    const previousContacts = contacts.filter((item) => {
      const createdAt = new Date(item.created_at).getTime();
      return (
        createdAt >= previousStart.getTime() &&
        createdAt < currentStart.getTime()
      );
    });

    const assignmentUserIds = Array.from(
      new Set(
        currentConversations
          .map((conversation) => conversation.assigned_user_id)
          .filter(Boolean),
      ),
    ) as string[];
    const profileNames = await this.fetchProfileNames(assignmentUserIds);

    const timelineData = timeline.map((bucket) => {
      const chats = currentConversations.filter((item) =>
        this.isWithinBucket(item.created_at, bucket),
      ).length;
      const contactsCount = currentContacts.filter((item) =>
        this.isWithinBucket(item.created_at, bucket),
      ).length;
      const campaignsCount = currentCampaigns.filter((item) =>
        this.isWithinBucket(item.created_at, bucket),
      ).length;
      const messagesCount = currentMessages.filter((item) =>
        this.isWithinBucket(item.created_at, bucket),
      ).length;

      return {
        campaigns: campaignsCount,
        chats,
        contacts: contactsCount,
        key: bucket.key,
        label: bucket.label,
        messages: messagesCount,
      };
    });

    const chatsByUser = this.buildChatsByUser(
      currentConversations,
      profileNames,
    );
    const campaignsByStatus = this.buildCampaignStatusSummary(currentCampaigns);
    const appointmentsByWeekday = this.buildAppointmentsByWeekday(appointments);
    const channelPerformance = this.buildChannelPerformance({
      campaigns: currentCampaigns,
      chats: currentConversations,
      connections,
      messages: currentMessages,
    });

    return {
      generatedAt: nowIso,
      range,
      scope: access.isAtendente ? 'restricted' : 'workspace',
      summary: {
        activeChats: currentConversations.filter(
          (item) => item.status === 'open',
        ).length,
        aiActiveChats: currentConversations.filter((item) => item.ai_enabled)
          .length,
        appointmentsThisWeek: appointments.length,
        archivedChats: currentConversations.filter(
          (item) => item.status === 'archived',
        ).length,
        campaignsCreated: this.buildMetricSnapshot(
          currentCampaigns.length,
          previousCampaigns.length,
        ),
        chatsStarted: this.buildMetricSnapshot(
          currentConversations.length,
          previousConversations.length,
        ),
        completedCampaigns: currentCampaigns.filter(
          (item) => item.status === 'completed',
        ).length,
        confirmedAppointmentsThisWeek: appointments.filter(
          (item) => item.status === 'confirmado',
        ).length,
        humanAttentionChats: currentConversations.filter(
          (item) => item.human_intervention_requested_at,
        ).length,
        messageVolume: this.buildMetricSnapshot(
          currentMessages.length,
          previousMessages.length,
        ),
        newContacts: this.buildMetricSnapshot(
          currentContacts.length,
          previousContacts.length,
        ),
        runningCampaigns: currentCampaigns.filter(
          (item) => item.status === 'running',
        ).length,
      },
      timeline: timelineData,
      chatsByUser,
      campaignsByStatus,
      appointmentsByWeekday,
      channelPerformance,
      recentCampaigns: currentCampaigns
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )
        .slice(0, 4)
        .map((campaign) => ({
          created_at: campaign.created_at,
          id: campaign.id,
          nome: campaign.nome,
          progress:
            campaign.total_contatos > 0
              ? Math.round(
                  ((campaign.total_contatos - campaign.pendentes) /
                    campaign.total_contatos) *
                    100,
                )
              : 0,
          status: campaign.status,
          total_contatos: campaign.total_contatos,
        })),
      topConnections: channelPerformance.slice(0, 5).map((item) => ({
        ...item,
        accent:
          item.status === 'connected'
            ? '#22c55e'
            : item.status === 'connecting'
              ? '#f59e0b'
              : '#ef4444',
      })),
      highlights: {
        connectionCount: connections.length,
        inboundMessages: currentMessages.filter(
          (item) => item.direction === 'inbound',
        ).length,
        outboundMessages: currentMessages.filter(
          (item) => item.direction === 'outbound',
        ).length,
      },
    };
  }

  private normalizeRange(value?: string): RangeOption {
    if (value === '7d' || value === '90d') {
      return value;
    }

    return '30d';
  }

  private async getAccessContext(userId: string): Promise<AccessContext> {
    const client = this.supabaseService.getClient();
    const { data: profile, error } = await client
      .from('profile')
      .select('tipo_de_usuario')
      .eq('auth_id', userId)
      .single();

    if (error || !profile) {
      throw new ForbiddenException('Perfil não encontrado.');
    }

    if (profile.tipo_de_usuario !== 'atendente') {
      return {
        allowedConnectionIds: null,
        effectiveProfileId: userId,
        isAtendente: false,
      };
    }

    const { data: attendant, error: attendantError } = await client
      .from('atendentes')
      .select('admin_id, whatsapp_ids')
      .eq('profile_id', userId)
      .maybeSingle();

    if (attendantError || !attendant) {
      throw new ForbiddenException('Atendente não vinculado a um admin.');
    }

    return {
      allowedConnectionIds: attendant.whatsapp_ids || [],
      effectiveProfileId: attendant.admin_id,
      isAtendente: true,
    };
  }

  private createTimelineBuckets(range: RangeOption) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const bucketDefinitions =
      range === '7d'
        ? { bucketSizeDays: 1, totalDays: 7 }
        : range === '90d'
          ? { bucketSizeDays: 7, totalDays: 84 }
          : { bucketSizeDays: 3, totalDays: 30 };

    const start = new Date(startOfToday);
    start.setDate(
      start.getDate() -
        (bucketDefinitions.totalDays - bucketDefinitions.bucketSizeDays),
    );

    const buckets: TimelineBucket[] = [];

    for (
      let cursor = new Date(start);
      cursor <= now;
      cursor = this.shiftDate(
        cursor,
        bucketDefinitions.bucketSizeDays * 24 * 60 * 60 * 1000,
      )
    ) {
      const bucketStart = new Date(cursor);
      const bucketEnd = this.shiftDate(
        bucketStart,
        bucketDefinitions.bucketSizeDays * 24 * 60 * 60 * 1000,
      );

      buckets.push({
        campaigns: 0,
        chats: 0,
        contacts: 0,
        end: bucketEnd,
        key: bucketStart.toISOString(),
        label: this.formatBucketLabel(range, bucketStart, bucketEnd),
        messages: 0,
        start: bucketStart,
      });
    }

    return buckets;
  }

  private formatBucketLabel(range: RangeOption, start: Date, end: Date) {
    if (range === '7d') {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(start);
    }

    if (range === '90d') {
      return `${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(start)} - ${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(this.shiftDate(end, -24 * 60 * 60 * 1000))}`;
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(start);
  }

  private shiftDate(date: Date, milliseconds: number) {
    return new Date(date.getTime() + milliseconds);
  }

  private applyConnectionScope<
    T extends { in: (column: string, values: string[]) => unknown },
  >(
    query: T,
    allowedConnectionIds: string[] | null,
    column = 'whatsapp_connection_id',
  ) {
    if (allowedConnectionIds === null) {
      return query;
    }

    if (!allowedConnectionIds.length) {
      query.in(column, ['00000000-0000-0000-0000-000000000000']);
      return query;
    }

    query.in(column, allowedConnectionIds);
    return query;
  }

  private async fetchConversations(
    profileId: string,
    since: string,
    allowedConnectionIds: string[] | null,
  ) {
    const query = this.supabaseService
      .getClient()
      .from('conversas')
      .select(
        'id, created_at, status, assigned_user_id, ai_enabled, human_intervention_requested_at, whatsapp_connection_id',
      )
      .eq('profile_id', profileId)
      .gte('created_at', since);

    this.applyConnectionScope(query, allowedConnectionIds);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as ConversationRow[];
  }

  private async fetchMessages(
    profileId: string,
    since: string,
    allowedConnectionIds: string[] | null,
  ) {
    const query = this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('created_at, direction, whatsapp_connection_id')
      .eq('profile_id', profileId)
      .gte('created_at', since);

    this.applyConnectionScope(query, allowedConnectionIds);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as MessageRow[];
  }

  private async fetchCampaigns(
    profileId: string,
    since: string,
    allowedConnectionIds: string[] | null,
  ) {
    const query = this.supabaseService
      .getClient()
      .from('campanhas')
      .select(
        'id, nome, status, created_at, total_contatos, enviados_com_sucesso, falhas, pendentes, whatsapp_connection_id',
      )
      .eq('profile_id', profileId)
      .gte('created_at', since);

    this.applyConnectionScope(query, allowedConnectionIds);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as CampaignRow[];
  }

  private async fetchContacts(
    profileId: string,
    since: string,
    scopedContactIds: string[] | null,
  ) {
    const query = this.supabaseService
      .getClient()
      .from('contatos')
      .select('id, created_at')
      .eq('profile_id', profileId)
      .gte('created_at', since);

    if (scopedContactIds !== null) {
      if (!scopedContactIds.length) {
        return [] as ContactRow[];
      }

      query.in('id', scopedContactIds);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as ContactRow[];
  }

  private async fetchAppointments(profileId: string) {
    const now = new Date();
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('agendamentos')
      .select('id, data_hora, status')
      .eq('profile_id', profileId)
      .gte('data_hora', now.toISOString())
      .lt('data_hora', rangeEnd.toISOString())
      .order('data_hora', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as AppointmentRow[];
  }

  private async fetchConnections(
    profileId: string,
    allowedConnectionIds: string[] | null,
  ) {
    const query = this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .select('id, nome, status')
      .eq('user_id', profileId)
      .order('nome', { ascending: true });

    if (allowedConnectionIds !== null) {
      if (!allowedConnectionIds.length) {
        return [] as ConnectionRow[];
      }

      query.in('id', allowedConnectionIds);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []) as ConnectionRow[];
  }

  private async getScopedContactIds(
    profileId: string,
    allowedConnectionIds: string[],
  ) {
    if (!allowedConnectionIds.length) {
      return [] as string[];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas')
      .select('contato_id')
      .eq('profile_id', profileId)
      .in('whatsapp_connection_id', allowedConnectionIds);

    if (error) {
      throw error;
    }

    return Array.from(
      new Set(
        ((data ?? []) as Array<{ contato_id: string | null }>)
          .map((item) => item.contato_id)
          .filter(Boolean),
      ),
    ) as string[];
  }

  private async fetchProfileNames(userIds: string[]) {
    if (!userIds.length) {
      return new Map<string, string>();
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profile')
      .select('auth_id, nome_completo')
      .in('auth_id', userIds);

    if (error) {
      throw error;
    }

    return new Map<string, string>(
      (
        (data ?? []) as Array<{
          auth_id: string;
          nome_completo: string | null;
        }>
      ).map((profile) => [
        profile.auth_id,
        profile.nome_completo || 'Atendente',
      ]),
    );
  }

  private isWithinBucket(value: string, bucket: TimelineBucket) {
    const timestamp = new Date(value).getTime();
    return (
      timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime()
    );
  }

  private buildMetricSnapshot(
    current: number,
    previous: number,
  ): MetricSnapshot {
    if (current === previous) {
      return {
        current,
        delta: 0,
        direction: 'flat',
        previous,
      };
    }

    if (previous === 0) {
      return {
        current,
        delta: current > 0 ? 100 : 0,
        direction: current > 0 ? 'up' : 'flat',
        previous,
      };
    }

    const rawDelta = ((current - previous) / previous) * 100;

    return {
      current,
      delta: Math.round(rawDelta),
      direction: rawDelta > 0 ? 'up' : 'down',
      previous,
    };
  }

  private buildChatsByUser(
    conversations: Array<{ assigned_user_id: string | null }>,
    profileNames: Map<string, string>,
  ) {
    const grouped = new Map<string, number>();

    conversations.forEach((conversation) => {
      const key = conversation.assigned_user_id || 'unassigned';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([id, count]) => ({
        count,
        id,
        name:
          id === 'unassigned'
            ? 'Sem responsavel'
            : profileNames.get(id) || 'Atendente',
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }

  private buildCampaignStatusSummary(campaigns: Array<{ status: string }>) {
    const base = ['draft', 'running', 'completed', 'failed'].map((status) => ({
      count: 0,
      status,
    }));

    campaigns.forEach((campaign) => {
      const target = base.find((item) => item.status === campaign.status);
      if (target) {
        target.count += 1;
      }
    });

    return base;
  }

  private buildAppointmentsByWeekday(
    appointments: Array<{ data_hora: string; status: string }>,
  ) {
    const base = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + index);

      return {
        cancelled: 0,
        confirmed: 0,
        key: date.toISOString(),
        label: new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          weekday: 'short',
        }).format(date),
        pending: 0,
        total: 0,
      };
    });

    appointments.forEach((appointment) => {
      const appointmentDay = new Date(appointment.data_hora);
      appointmentDay.setHours(0, 0, 0, 0);
      const target = base.find(
        (item) => new Date(item.key).getTime() === appointmentDay.getTime(),
      );

      if (!target) {
        return;
      }

      target.total += 1;
      if (appointment.status === 'confirmado') {
        target.confirmed += 1;
      } else if (appointment.status === 'cancelado') {
        target.cancelled += 1;
      } else {
        target.pending += 1;
      }
    });

    return base;
  }

  private buildChannelPerformance(params: {
    campaigns: Array<{
      status: string;
      whatsapp_connection_id: string;
    }>;
    chats: Array<{ whatsapp_connection_id: string }>;
    connections: Array<{ id: string; nome: string; status: string }>;
    messages: Array<{ whatsapp_connection_id: string }>;
  }) {
    const performance = params.connections.map((connection) => ({
      campaigns: params.campaigns.filter(
        (campaign) => campaign.whatsapp_connection_id === connection.id,
      ).length,
      chats: params.chats.filter(
        (chat) => chat.whatsapp_connection_id === connection.id,
      ).length,
      id: connection.id,
      messages: params.messages.filter(
        (message) => message.whatsapp_connection_id === connection.id,
      ).length,
      name: connection.nome,
      status: connection.status,
    }));

    return performance.sort((left, right) => right.messages - left.messages);
  }
}
