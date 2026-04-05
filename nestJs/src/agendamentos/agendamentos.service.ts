import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GoogleService } from '../google/google.service';

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
}
