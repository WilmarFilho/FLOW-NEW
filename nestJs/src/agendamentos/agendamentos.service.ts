import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GoogleService } from '../google/google.service';

type BusinessHours = {
  timezone?: string;
  days?: Record<string, Array<{ start: string; end: string }>>;
};

@Injectable()
export class AgendamentosService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly googleService: GoogleService
  ) {}

  async listAgendamentos(profileId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        contatos (nome, avatar_url)
      `)
      .eq('profile_id', profileId);

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    return data;
  }

  async createAgendamento(profileId: string, data: any) {
    const supabase = this.supabaseService.getClient();

    const novo = {
      profile_id: profileId,
      contato_id: data.contato_id,
      titulo: data.titulo,
      data_hora: data.data_hora,
      data_hora_fim: data.data_hora_fim,
      status: data.status || 'pendente'
    };

    const { data: result, error } = await supabase
      .from('agendamentos')
      .insert(novo)
      .select(`*, contatos (nome, avatar_url)`)
      .single();

    if (error) {
      if (error.message.includes('Conflito de horário')) {
        throw new HttpException('Conflito de horário: Este momento já está ocupado.', HttpStatus.CONFLICT);
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    // Verificar se o usuário tem integração Google ativa
    const googleStatus = await this.googleService.getGoogleStatus(profileId);

    if (googleStatus.connected) {
      // Usuário tem Google Calendar: sincronização é OBRIGATÓRIA
      const googleEventId = await this.googleService.createCalendarEvent(profileId, {
        titulo: result.titulo,
        descricao: result.descricao,
        data_hora: result.data_hora,
        data_hora_fim: result.data_hora_fim
      });

      if (!googleEventId) {
        // Rollback: remove o agendamento do banco pois falhou no Calendar
        await supabase.from('agendamentos').delete().eq('id', result.id);
        throw new HttpException(
          'Falha ao criar evento no Google Calendar. O agendamento não foi salvo.',
          HttpStatus.BAD_GATEWAY
        );
      }

      // Salvo com sucesso nos dois lugares: atualiza o google_event_id
      await supabase
        .from('agendamentos')
        .update({ google_event_id: googleEventId })
        .eq('id', result.id);

      result.google_event_id = googleEventId;
    }
    // Se não tem integração Google, retorna normalmente

    return result;
  }

  async updateStatus(profileId: string, id: string, status: string) {
    const supabase = this.supabaseService.getClient();

    const { data: result, error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .eq('profile_id', profileId)
      .select(`*, contatos (nome, avatar_url)`)
      .single();

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  async deleteAgendamento(profileId: string, id: string) {
    const supabase = this.supabaseService.getClient();

    // Check if the event exists and has a google_event_id
    const { data: event, error: fetchError } = await supabase
      .from('agendamentos')
      .select('google_event_id')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();

    if (fetchError) {
      throw new HttpException('Agendamento não encontrado', HttpStatus.NOT_FOUND);
    }

    if (event.google_event_id) {
       await this.googleService.deleteCalendarEvent(profileId, event.google_event_id);
    }

    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId);

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    return { success: true };
  }

  async getAvailableSlots(params: {
    businessHours: BusinessHours;
    daysAhead?: number;
    profileId: string;
    slotMinutes?: number;
  }) {
    const daysAhead = params.daysAhead || 7;
    const slotMinutes = params.slotMinutes || 60;
    const timezone = params.businessHours.timezone || 'America/Sao_Paulo';
    const now = new Date();
    const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const occupiedIntervals = await this.getOccupiedIntervals(
      params.profileId,
      now.toISOString(),
      rangeEnd.toISOString(),
    );
    const availableSlots: Array<{
      endAt: string;
      label: string;
      startAt: string;
    }> = [];

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
      const currentDate = new Date(now);
      currentDate.setHours(0, 0, 0, 0);
      currentDate.setDate(currentDate.getDate() + dayOffset);

      const weekdayKey = this.getWeekdayKey(currentDate);
      const windows = params.businessHours.days?.[weekdayKey] || [];

      for (const window of windows) {
        const [startHour, startMinute] = window.start.split(':').map(Number);
        const [endHour, endMinute] = window.end.split(':').map(Number);

        const cursor = new Date(currentDate);
        cursor.setHours(startHour, startMinute, 0, 0);

        const windowEnd = new Date(currentDate);
        windowEnd.setHours(endHour, endMinute, 0, 0);

        while (cursor.getTime() + slotMinutes * 60 * 1000 <= windowEnd.getTime()) {
          const slotStart = new Date(cursor);
          const slotEnd = new Date(cursor.getTime() + slotMinutes * 60 * 1000);

          if (
            slotStart.getTime() > now.getTime() + 30 * 60 * 1000 &&
            !this.hasCollision(slotStart, slotEnd, occupiedIntervals)
          ) {
            availableSlots.push({
              endAt: slotEnd.toISOString(),
              label: this.formatSlotLabel(slotStart, timezone),
              startAt: slotStart.toISOString(),
            });
          }

          cursor.setMinutes(cursor.getMinutes() + slotMinutes);
        }
      }
    }

    return availableSlots.slice(0, 12);
  }

  async createAutomaticAgendamento(params: {
    contatoId: string;
    dataHora: string;
    dataHoraFim: string;
    descricao?: string;
    profileId: string;
    status?: string;
    titulo: string;
  }) {
    return this.createAgendamento(params.profileId, {
      contato_id: params.contatoId,
      data_hora: params.dataHora,
      data_hora_fim: params.dataHoraFim,
      descricao: params.descricao,
      status: params.status || 'confirmado',
      titulo: params.titulo,
    });
  }

  private async getOccupiedIntervals(
    profileId: string,
    timeMin: string,
    timeMax: string,
  ) {
    const supabase = this.supabaseService.getClient();
    const { data: dbEvents } = await supabase
      .from('agendamentos')
      .select('data_hora, data_hora_fim, status')
      .eq('profile_id', profileId)
      .neq('status', 'cancelado')
      .gte('data_hora', timeMin)
      .lte('data_hora', timeMax);

    const googleBusy = await this.googleService.listBusyIntervals(profileId, timeMin, timeMax);

    const appIntervals = (dbEvents || []).map((event) => ({
      end: event.data_hora_fim || new Date(new Date(event.data_hora).getTime() + 60 * 60 * 1000).toISOString(),
      start: event.data_hora,
    }));

    return [...appIntervals, ...googleBusy];
  }

  private hasCollision(
    start: Date,
    end: Date,
    occupiedIntervals: Array<{ end?: string | null; start?: string | null }>,
  ) {
    return occupiedIntervals.some((interval) => {
      if (!interval.start || !interval.end) {
        return false;
      }

      const intervalStart = new Date(interval.start).getTime();
      const intervalEnd = new Date(interval.end).getTime();

      return start.getTime() < intervalEnd && end.getTime() > intervalStart;
    });
  }

  private getWeekdayKey(date: Date) {
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      date.getDay()
    ];
  }

  private formatSlotLabel(date: Date, timezone: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      timeZone: timezone,
      weekday: 'short',
    }).format(date);
  }
}
