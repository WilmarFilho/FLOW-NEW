/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/only-throw-error */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LogsService } from '../logs/logs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { CreateCampanhaDto } from './dto/create-campanha.dto';

type CampaignStatus = 'draft' | 'running' | 'completed' | 'failed';

@Injectable()
export class CampanhasService {
  private readonly logger = new Logger(CampanhasService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly logsService: LogsService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async listCampaigns(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('campanhas')
      .select(
        `
        *,
        whatsapp_connections:whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          cor
        ),
        contatos_listas (
          id,
          nome,
          cor
        ),
        source_whatsapp_connection:source_whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          cor
        )
      `,
      )
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      await this.logsService.error({
        action: 'campanhas.listCampaigns',
        context: CampanhasService.name,
        error,
        message: `Failed to list campaigns: ${error.message}`,
        user_id: userId,
      });
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
        mensagem_personalizada,
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
      await this.logsService.error({
        action: 'campanhas.getCampaignById.recipients',
        context: CampanhasService.name,
        error: recipientsError,
        message: `Failed to list campaign recipients ${campaignId}: ${recipientsError.message}`,
        metadata: { campaignId },
        user_id: userId,
      });
      throw recipientsError;
    }

    return {
      ...campaign,
      destinatarios: recipients ?? [],
    };
  }

  async createCampaign(userId: string, dto: CreateCampanhaDto) {
    const nome = dto.nome?.trim();
    const contexto = dto.contexto?.trim();
    const sourceType = dto.source_type === 'connection' ? 'connection' : 'lista';

    if (!nome) {
      throw new BadRequestException('Informe o nome da campanha.');
    }

    if (!contexto) {
      throw new BadRequestException('Informe o contexto da campanha.');
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

    let lista: { id: string; nome: string; cor: string | null } | null = null;
    let recipients: any[] = [];

    if (sourceType === 'lista') {
      if (!dto.lista_id) {
        throw new BadRequestException('Selecione uma lista para a campanha.');
      }

      const { data: foundList, error: listError } = await client
        .from('contatos_listas')
        .select('id, nome, cor')
        .eq('id', dto.lista_id)
        .eq('profile_id', userId)
        .single();

      if (listError || !foundList) {
        throw new NotFoundException('Lista de contatos não encontrada.');
      }

      lista = foundList;

      const { data: relations, error: relationsError } = await client
        .from('contatos_listas_rel')
        .select(
          `
          contato_id,
          contatos:contato_id (
            id,
            nome,
            whatsapp,
            avatar_url,
            deleted_at
          )
        `,
        )
        .eq('lista_id', dto.lista_id);

      if (relationsError) {
        await this.logsService.error({
          action: 'campanhas.createCampaign.listRecipients',
          context: CampanhasService.name,
          error: relationsError,
          message: `Failed to load contacts for campaign creation: ${relationsError.message}`,
          metadata: { listaId: dto.lista_id },
          user_id: userId,
        });
        throw relationsError;
      }

      recipients = (relations ?? [])
        .map((relation: any) => relation.contatos)
        .filter(
          (contact: any) =>
            Boolean(contact?.whatsapp) && !contact?.deleted_at,
        );
    } else {
      if (!dto.source_whatsapp_connection_id) {
        throw new BadRequestException(
          'Selecione a conexão que será usada como origem do público.',
        );
      }

      const { data: sourceConnection, error: sourceConnectionError } =
        await client
          .from('whatsapp_connections')
          .select('id, nome, numero, status, cor')
          .eq('id', dto.source_whatsapp_connection_id)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .single();

      if (sourceConnectionError || !sourceConnection) {
        throw new NotFoundException(
          'Conexão de origem do público não encontrada.',
        );
      }

      const { data: connectionContacts, error: connectionContactsError } =
        await client
          .from('contatos_whatsapp_connections')
          .select(
            `
            contato_id,
            last_seen_at,
            contatos:contato_id (
              id,
              nome,
              whatsapp,
              avatar_url,
              deleted_at
            )
          `,
          )
          .eq('profile_id', userId)
          .eq('whatsapp_connection_id', dto.source_whatsapp_connection_id)
          .order('last_seen_at', { ascending: false });

      if (connectionContactsError) {
        await this.logsService.error({
          action: 'campanhas.createCampaign.connectionRecipients',
          context: CampanhasService.name,
          error: connectionContactsError,
          message: `Failed to load connection contacts for campaign creation: ${connectionContactsError.message}`,
          metadata: {
            sourceWhatsappConnectionId: dto.source_whatsapp_connection_id,
          },
          user_id: userId,
        });
        throw connectionContactsError;
      }

      const uniqueRecipients = new Map<string, any>();
      for (const relation of connectionContacts ?? []) {
        const contact = this.unwrapRelation<any>(relation.contatos);
        if (!contact?.id || !contact?.whatsapp || contact.deleted_at) {
          continue;
        }

        if (!uniqueRecipients.has(contact.id)) {
          uniqueRecipients.set(contact.id, contact);
        }
      }

      recipients = Array.from(uniqueRecipients.values());
    }

    if (recipients.length === 0) {
      throw new BadRequestException(
        sourceType === 'lista'
          ? 'A lista selecionada não possui contatos válidos para envio.'
          : 'A conexão selecionada não possui contatos válidos para envio.',
      );
    }

    const { data: campaign, error: campaignError } = await client
      .from('campanhas')
      .insert({
        profile_id: userId,
        whatsapp_connection_id: dto.whatsapp_connection_id,
        lista_id: dto.lista_id || null,
        source_type: sourceType,
        source_whatsapp_connection_id: dto.source_whatsapp_connection_id || null,
        nome,
        contexto,
        total_contatos: recipients.length,
        pendentes: recipients.length,
      })
      .select(
        `
        *,
        whatsapp_connections:whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          cor
        ),
        contatos_listas (
          id,
          nome,
          cor
        ),
        source_whatsapp_connection:source_whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          cor
        )
      `,
      )
      .single();

    if (campaignError || !campaign) {
      await this.logsService.error({
        action: 'campanhas.createCampaign',
        context: CampanhasService.name,
        error: campaignError,
        message: `Failed to create campaign: ${campaignError?.message || 'unknown error'}`,
        user_id: userId,
      });
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
      await this.logsService.error({
        action: 'campanhas.createCampaign.recipientsInsert',
        context: CampanhasService.name,
        error: recipientsInsertError,
        message: `Failed to create campaign recipients: ${recipientsInsertError.message}`,
        metadata: { campaignId: campaign.id },
        user_id: userId,
      });
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
        whatsapp_connections:whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          instance_name,
          cor
        ),
        contatos_listas (
          id,
          nome,
          cor
        ),
        source_whatsapp_connection:source_whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
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

      await this.logsService.error({
        action: 'campanhas.startCampaign',
        context: CampanhasService.name,
        error,
        message: `Failed to start campaign ${campaignId}: ${error.message}`,
        metadata: { campaignId },
        user_id: userId,
      });
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
          contexto,
          mensagem,
          total_contatos,
          profile_id,
          whatsapp_connections:whatsapp_connection_id (
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
        .select('id, nome, whatsapp, contato_id')
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
        try {
          const phoneNumber = this.normalizeWhatsapp(recipient.whatsapp);

          if (!phoneNumber) {
            falhas += 1;
            pendentes -= 1;
            lastError = `Contato ${recipient.nome} sem WhatsApp válido.`;

            await this.markRecipientFailed(campaignId, recipient.id, lastError, null, {
              enviadosComSucesso,
              falhas,
              pendentes,
              lastError,
            });
            continue;
          }

          const personalizedMessage = await this.generateRecipientMessage({
            campaignContext: campaign.contexto?.trim() || campaign.mensagem?.trim() || '',
            contactId: recipient.contato_id || null,
            contactName: recipient.nome,
            profileId: userId,
          });

          const result = await this.evolutionApiService.sendTextMessage(
            connection.instance_name,
            phoneNumber,
            personalizedMessage,
          );

          if (result) {
            enviadosComSucesso += 1;
            pendentes -= 1;
            await this.markRecipientSent(campaignId, recipient.id, personalizedMessage, {
              enviadosComSucesso,
              falhas,
              pendentes,
            });

            // Increment usage
            await client.rpc('increment_contatos_campanhas', { p_profile_id: userId });
          } else {
            falhas += 1;
            pendentes -= 1;
            lastError = `Falha ao enviar para ${recipient.nome}.`;

            await this.markRecipientFailed(campaignId, recipient.id, lastError, personalizedMessage, {
              enviadosComSucesso,
              falhas,
              pendentes,
              lastError,
            });
          }
        } catch (error) {
          falhas += 1;
          pendentes -= 1;
          lastError =
            error instanceof Error
              ? `Falha ao processar ${recipient.nome}: ${error.message}`
              : `Falha ao processar ${recipient.nome}.`;

          await this.markRecipientFailed(campaignId, recipient.id, lastError, null, {
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
    personalizedMessage: string,
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
        mensagem_personalizada: personalizedMessage,
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
    personalizedMessage: string | null,
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
        mensagem_personalizada: personalizedMessage,
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
        whatsapp_connections:whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          instance_name,
          cor
        ),
        contatos_listas (
          id,
          nome,
          cor
        ),
        source_whatsapp_connection:source_whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
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

  private async generateRecipientMessage(params: {
    campaignContext: string;
    contactId: string | null;
    contactName: string;
    profileId: string;
  }) {
    const fallback = `Oii ${params.contactName}, passando para compartilhar uma campanha pensada para você. ${params.campaignContext}`.trim();

    if (!this.openai) {
      return fallback.slice(0, 900);
    }

    const conversationContext = params.contactId
      ? await this.getRecentConversationContext(params.profileId, params.contactId)
      : null;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: `Você escreve mensagens curtas e naturais de campanha para WhatsApp.
Objetivo:
- personalizar a mensagem usando o contexto da campanha e o histórico recente do contato
- manter tom humano, comercial e conversacional
- evitar parecer spam
- não inventar fatos não sustentados pelo histórico
- no máximo 420 caracteres
- sem markdown
- apenas uma mensagem final
Retorne JSON:
{
  "message": "texto final"
}`,
        },
        {
          role: 'user',
          content: `Nome do contato: ${params.contactName}

Contexto da campanha:
${params.campaignContext}

Últimas conversas do contato:
${conversationContext || 'Sem histórico relevante disponível.'}

Crie uma mensagem personalizada de WhatsApp, em português do Brasil, usando o contexto da campanha e, se fizer sentido, detalhes reais da conversa recente.`,
        },
      ],
    });

    try {
      const parsed = JSON.parse(
        completion.choices[0]?.message?.content || JSON.stringify({ message: fallback }),
      ) as { message?: string };

      return (parsed.message?.trim() || fallback).slice(0, 900);
    } catch {
      return fallback.slice(0, 900);
    }
  }

  private async getRecentConversationContext(profileId: string, contactId: string) {
    const client = this.supabaseService.getClient();
    const { data: conversations, error: conversationsError } = await client
      .from('conversas')
      .select('id')
      .eq('profile_id', profileId)
      .eq('contato_id', contactId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    if (conversationsError) {
      throw conversationsError;
    }

    if (!conversations?.length) {
      return null;
    }

    const { data: messages, error: messagesError } = await client
      .from('conversas_mensagens')
      .select('direction, sender_type, content, ai_context_text, created_at')
      .in(
        'conversa_id',
        conversations.map((conversation) => conversation.id),
      )
      .neq('direction', 'system')
      .order('created_at', { ascending: false })
      .limit(20);

    if (messagesError) {
      throw messagesError;
    }

    const lines = [...(messages || [])]
      .reverse()
      .map((message) => {
        const content = message.ai_context_text?.trim() || message.content?.trim();
        if (!content) {
          return null;
        }

        const speaker =
          message.direction === 'inbound' || message.sender_type === 'customer'
            ? 'Cliente'
            : 'Equipe';

        return `[${speaker}] ${content}`;
      })
      .filter((line): line is string => Boolean(line));

    return lines.length ? lines.join('\n').slice(0, 5000) : null;
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
