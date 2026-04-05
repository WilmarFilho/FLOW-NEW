import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { google } from 'googleapis';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GoogleService {
  private oauth2Client;

  constructor(private readonly supabaseService: SupabaseService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  // Gera a URL para a tela de Consentimento
  getAuthUrl(profileId: string) {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Permite receber refresh token
      prompt: 'consent', // Garante o recebimento do refresh token na tela
      scope: scopes,
      state: profileId, // Passa o ID do usuário como estado para o redirect
    });
  }

  // Processa o code após a autorização do usuário e salva no perfil
  async handleCallback(code: string, state: string) {
    try {
      if (!state) {
        throw new HttpException('User ID ausente no estado', HttpStatus.BAD_REQUEST);
      }

      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Descobre o email logado
      const oauth2API = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2API.userinfo.get();
      const email = userInfo.data.email;

      const supabase = this.supabaseService.getClient();

      // Upsert na tabela de integrations
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          profile_id: state,
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          provider_account_email: email,
          token_expiry: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, provider' });

      if (error) {
         throw new HttpException(`Erro DB: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return { success: true };
    } catch (err: any) {
      console.error(err);
      throw new HttpException('Falha na integração com o Google', HttpStatus.BAD_REQUEST);
    }
  }

  // Verifica as integrações
  async getGoogleStatus(profileId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_integrations')
      .select('provider_account_email')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .single();

    if (error || !data) return { connected: false, email: null };

    return { connected: true, email: data.provider_account_email };
  }

  // Remove Integração
  async disconnectGoogle(profileId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('profile_id', profileId)
      .eq('provider', 'google');

    if (error) throw new HttpException('Falha ao desconectar', HttpStatus.INTERNAL_SERVER_ERROR);
    return { success: true };
  }
  // Cria um evento físico no Google Calendar do usuário
  async createCalendarEvent(profileId: string, eventData: { titulo: string; descricao?: string; data_hora: string; data_hora_fim: string }) {
    const supabase = this.supabaseService.getClient();
    
    // Puxa as credenciais
    const { data: tokenData, error } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .single();

    if (error || !tokenData) {
      return null; // O usuário não tem integração
    }

    // A library Googleapis faz refresh sozinha caso o access_token tenha expirado se um refresh_token for setado
    this.oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    try {
      const gEvent = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: eventData.titulo,
          description: eventData.descricao || '',
          start: {
            dateTime: new Date(eventData.data_hora).toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: new Date(eventData.data_hora_fim).toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
        },
      });

      return gEvent.data.id; // Retorna o ID do google
    } catch (err: any) {
      console.error('Falha ao criar evento no Googe Calendar:', err.message);
      // Aqui poderíamos forçar limpar o token se o erro for AuthError e o refresh_token falhou, 
      // Mas para manter a fluidez, retornaremos null para indicar falha apenas desse evento.
      return null;
    }
  }

  // Exclui um evento no Google Calendar
  async deleteCalendarEvent(profileId: string, eventId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: tokenData, error } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .single();

    if (error || !tokenData) {
      return false; // Sem integração
    }

    this.oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
      return true;
    } catch (err: any) {
      console.error('Falha ao excluir evento no Googe Calendar:', err.message);
      return false;
    }
  }
}
