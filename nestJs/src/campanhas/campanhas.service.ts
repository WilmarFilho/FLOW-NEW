/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/only-throw-error */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { CreateCampanhaDto } from './dto/create-campanha.dto';

type CampaignStatus = 'draft' | 'running' | 'completed' | 'failed';

@Injectable()
export class CampanhasService {
  private readonly logger = new Logger(CampanhasService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly logsService: LogsService,
  ) {}

  async listCampaigns(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('campanhas')
      .select(
        `
        *,
        whatsapp_connections (
          id,
          nome,
          numero,
          status
        ),
        contatos_listas (
          id,
          nome,
          cor
        )
      `,
      )
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list campaigns: ${error.message}`);
      throw error;
    }

    return data ?? [];
  }

  async getCampaignById(userId: string, campaignId: string) {
    const campaign = await this.getOwnedCampaign(userId, campaignId);

    const { data: recipients, error: recipientsError } =
      await this.supabaseService
        .getClient()
        .from('campanhas_destinatarios')
        .select(
          `
        id,
        contato_id,
        nome,
        whatsapp,
        avatar_url,
        status,
        error_message,
        sent_at,
        created_at,
        updated_at
      `,
        )
        .eq('campanha_id', campaignId)
        .order('created_at', { ascending: true });

    if (recipientsError) {
      this.logger.error(
        `Failed to list campaign recipients ${campaignId}: ${recipientsError.message}`,
      );
      throw recipientsError;
    }

    return {
      ...campaign,
      destinatarios: recipients ?? [],
    };
  }

  async createCampaign(userId: string, dto: CreateCampanhaDto) {
    const nome = dto.nome?.trim();
    const mensagem = dto.mensagem?.trim();

    if (!nome) {
      throw new BadRequestException('Informe o nome da campanha.');
    }

    if (!mensagem) {
      throw new BadRequestException('Informe a mensagem da campanha.');
    }

    const client = this.supabaseService.getClient();

    const { data: connection, error: connectionError } = await client
      .from('whatsapp_connections')
      .select('id, nome, status')
      .eq('id', dto.whatsapp_connection_id)
      .eq('user_id', userId)
      .single();

    if (connectionError || !connection) {
      throw new NotFoundException('Conexão de WhatsApp não encontrada.');
    }

    if (connection.status !== 'connected') {
      throw new BadRequestException(
        'Selecione um WhatsApp conectado e ativo para criar a campanha.',
      );
    }

    const { data: lista, error: listError } = await client
      .from('contatos_listas')
      .select('id, nome, cor')
      .eq('id', dto.lista_id)
      .eq('profile_id', userId)
      .single();

    if (listError || !lista) {
      throw new NotFoundException('Lista de contatos não encontrada.');
    }

    const { data: relations, error: relationsError } = await client
      .from('contatos_listas_rel')
      .select(
        `
        contato_id,
        contatos:contato_id (
          id,
          nome,
          whatsapp,
          avatar_url
        )
      `,
      )
      .eq('lista_id', dto.lista_id);

    if (relationsError) {
      this.logger.error(
        `Failed to load contacts for campaign creation: ${relationsError.message}`,
      );
      throw relationsError;
    }

    const recipients = (relations ?? [])
      .map((relation: any) => relation.contatos)
      .filter((contact: any) => Boolean(contact?.whatsapp));

    if (recipients.length === 0) {
      throw new BadRequestException(
        'A lista selecionada não possui contatos válidos para envio.',
      );
    }

    const { data: campaign, error: campaignError } = await client
      .from('campanhas')
      .insert({
        profile_id: userId,
        whatsapp_connection_id: dto.whatsapp_connection_id,
        lista_id: dto.lista_id,
        nome,
        mensagem,
        total_contatos: recipients.length,
        pendentes: recipients.length,
      })
      .select(
        `
        *,
        whatsapp_connections (
          id,
          nome,
          numero,
          status
        ),
        contatos_listas (
          id,
          nome,
          cor
        )
      `,
      )
      .single();

    if (campaignError || !campaign) {
      this.logger.error(`Failed to create campaign: ${campaignError?.message}`);
      throw campaignError;
    }

    const payload = recipients.map((contact: any) => ({
      campanha_id: campaign.id,
      contato_id: contact.id,
      nome: contact.nome,
      whatsapp: contact.whatsapp,
      avatar_url: contact.avatar_url || null,
    }));

    const { error: recipientsInsertError } = await client
      .from('campanhas_destinatarios')
      .insert(payload);

    if (recipientsInsertError) {
      await client.from('campanhas').delete().eq('id', campaign.id);
      this.logger.error(
        `Failed to create campaign recipients: ${recipientsInsertError.message}`,
      );
      throw recipientsInsertError;
    }

    return this.getCampaignById(userId, campaign.id);
  }

  async startCampaign(userId: string, campaignId: string) {
    const campaign = await this.getOwnedCampaign(userId, campaignId);

    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        'Esta campanha já foi iniciada ou concluída.',
      );
    }

    const connection = this.unwrapRelation<{
      id: string;
      nome: string;
      status: string;
      instance_name?: string;
    }>(campaign.whatsapp_connections);

    if (!connection || connection.status !== 'connected') {
      throw new BadRequestException(
        'O WhatsApp selecionado precisa estar conectado para iniciar a campanha.',
      );
    }

    const startedAt = new Date().toISOString();
    const { data: startedCampaign, error } = await this.supabaseService
      .getClient()
      .from('campanhas')
      .update({
        status: 'running',
        started_at: startedAt,
        updated_at: startedAt,
        last_error: null,
      })
      .eq('id', campaignId)
      .eq('profile_id', userId)
      .eq('status', 'draft')
      .select(
        `
        *,
        whatsapp_connections (
          id,
          nome,
          numero,
          status,
          instance_name
        ),
        contatos_listas (
          id,
          nome,
          cor
        )
      `,
      )
      .single();

    if (error || !startedCampaign) {
      if (!error) {
        throw new ConflictException(
          'Esta campanha já foi iniciada por outro processo.',
        );
      }

      this.logger.error(
        `Failed to start campaign ${campaignId}: ${error.message}`,
      );
      throw error;
    }

    void this.processCampaign(startedCampaign.id, userId);

    return startedCampaign;
  }

  private async processCampaign(campaignId: string, userId: string) {
    const client = this.supabaseService.getClient();

    try {
      const { data: campaign, error: campaignError } = await client
        .from('campanhas')
        .select(
          `
          id,
          nome,
          mensagem,
          total_contatos,
          profile_id,
          whatsapp_connections (
            id,
            nome,
            status,
            instance_name
          )
        `,
        )
        .eq('id', campaignId)
        .eq('profile_id', userId)
        .single();

      if (campaignError || !campaign) {
        throw new Error('Campanha não encontrada para processamento.');
      }

      const connection = this.unwrapRelation<{
        id: string;
        nome: string;
        status: string;
        instance_name: string;
      }>(campaign.whatsapp_connections);

      if (!connection?.instance_name || connection.status !== 'connected') {
        throw new Error('A conexão selecionada não está pronta para envio.');
      }

      const { data: recipients, error: recipientsError } = await client
        .from('campanhas_destinatarios')
        .select('id, nome, whatsapp')
        .eq('campanha_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (recipientsError) {
        throw recipientsError;
      }

      let enviadosComSucesso = 0;
      let falhas = 0;
      let pendentes = recipients?.length ?? 0;
      let lastError: string | null = null;

      for (const recipient of recipients ?? []) {
        const phoneNumber = this.normalizeWhatsapp(recipient.whatsapp);

        if (!phoneNumber) {
          falhas += 1;
          pendentes -= 1;
          lastError = `Contato ${recipient.nome} sem WhatsApp válido.`;

          await this.markRecipientFailed(campaignId, recipient.id, lastError, {
            enviadosComSucesso,
            falhas,
            pendentes,
            lastError,
          });
          continue;
        }

        const result = await this.evolutionApiService.sendTextMessage(
          connection.instance_name,
          phoneNumber,
          campaign.mensagem,
        );

        if (result) {
          enviadosComSucesso += 1;
          pendentes -= 1;
          await this.markRecipientSent(campaignId, recipient.id, {
            enviadosComSucesso,
            falhas,
            pendentes,
          });
        } else {
          falhas += 1;
          pendentes -= 1;
          lastError = `Falha ao enviar para ${recipient.nome}.`;

          await this.markRecipientFailed(campaignId, recipient.id, lastError, {
            enviadosComSucesso,
            falhas,
            pendentes,
            lastError,
          });
        }

        await this.sleep(350);
      }

      const status: CampaignStatus =
        enviadosComSucesso > 0 ? 'completed' : 'failed';
      const finishedAt = new Date().toISOString();

      await client
        .from('campanhas')
        .update({
          status,
          enviados_com_sucesso: enviadosComSucesso,
          falhas,
          pendentes,
          completed_at: finishedAt,
          updated_at: finishedAt,
          last_error:
            status === 'failed'
              ? (lastError ?? 'Nenhuma mensagem foi enviada.')
              : lastError,
        })
        .eq('id', campaignId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro inesperado ao processar campanha.';

      await client
        .from('campanhas')
        .update({
          status: 'failed',
          last_error: message,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      await this.logsService.createLog({
        level: 'error',
        action: 'campanhas.processCampaign',
        message,
        metadata: { campaignId },
        user_id: userId,
      });
    }
  }

  private async markRecipientSent(
    campaignId: string,
    recipientId: string,
    counters: {
      enviadosComSucesso: number;
      falhas: number;
      pendentes: number;
    },
  ) {
    const client = this.supabaseService.getClient();
    const sentAt = new Date().toISOString();

    await client
      .from('campanhas_destinatarios')
      .update({
        status: 'sent',
        sent_at: sentAt,
        updated_at: sentAt,
        error_message: null,
      })
      .eq('id', recipientId)
      .eq('campanha_id', campaignId);

    await client
      .from('campanhas')
      .update({
        enviados_com_sucesso: counters.enviadosComSucesso,
        falhas: counters.falhas,
        pendentes: counters.pendentes,
        updated_at: sentAt,
      })
      .eq('id', campaignId);
  }

  private async markRecipientFailed(
    campaignId: string,
    recipientId: string,
    errorMessage: string,
    counters: {
      enviadosComSucesso: number;
      falhas: number;
      pendentes: number;
      lastError: string | null;
    },
  ) {
    const client = this.supabaseService.getClient();
    const updatedAt = new Date().toISOString();

    await client
      .from('campanhas_destinatarios')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: updatedAt,
      })
      .eq('id', recipientId)
      .eq('campanha_id', campaignId);

    await client
      .from('campanhas')
      .update({
        enviados_com_sucesso: counters.enviadosComSucesso,
        falhas: counters.falhas,
        pendentes: counters.pendentes,
        updated_at: updatedAt,
        last_error: counters.lastError,
      })
      .eq('id', campaignId);
  }

  private async getOwnedCampaign(userId: string, campaignId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('campanhas')
      .select(
        `
        *,
        whatsapp_connections (
          id,
          nome,
          numero,
          status,
          instance_name
        ),
        contatos_listas (
          id,
          nome,
          cor
        )
      `,
      )
      .eq('id', campaignId)
      .eq('profile_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    return data;
  }

  private normalizeWhatsapp(value: string | null | undefined) {
    const digits = (value ?? '').replace(/\D/g, '');
    return digits.length >= 10 ? digits : null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private unwrapRelation<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
