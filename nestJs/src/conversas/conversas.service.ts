/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { AgendamentosService } from '../agendamentos/agendamentos.service';
import { LogsService } from '../logs/logs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { CreateConversaDto } from './dto/create-conversa.dto';
import {
  ListConversasParams,
  ListMensagensParams,
  PaginatedResult,
} from './dto/list-conversas.dto';

type AccessContext = {
  allowedConnectionIds: string[] | null;
  effectiveAdminId: string;
  isAtendente: boolean;
  userId: string;
};

type IncomingMessage = {
  aiContextText: string | null;
  content: string | null;
  mediaBuffer: Buffer | null;
  mediaMimeType: string | null;
  messageType: 'text' | 'audio' | 'image' | 'video' | 'sticker' | 'unsupported';
  phone: string;
  pushName: string | null;
  rawPayload: Record<string, unknown>;
  remoteJid: string | null;
};

type ConversationBatch = {
  id: string;
  conversa_id: string;
  profile_id: string;
  message_ids: string[];
  scheduled_for: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
};

type AutomationReply = {
  handoffReason: string | null;
  parts: string[];
  shouldHandoff: boolean;
};

@Injectable()
export class ConversasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConversasService.name);
  private readonly openai: OpenAI;
  private readonly embeddingModel = 'text-embedding-3-large';
  private readonly responseModel = 'gpt-4.1-mini';
  private batchPoller: NodeJS.Timeout | null = null;
  private isProcessingBatches = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly agendamentosService: AgendamentosService,
    @Inject(forwardRef(() => EvolutionApiService))
    private readonly evolutionApiService: EvolutionApiService,
    private readonly logsService: LogsService,
  ) {
    this.openai = new OpenAI({
      apiKey:
        this.configService.get<string>('OPENAI_API_KEY') ||
        'sk-placeholder-configure-env',
    });
  }

  onModuleInit() {
    this.batchPoller = setInterval(() => {
      void this.processPendingBatches();
    }, 8_000);
  }

  onModuleDestroy() {
    if (this.batchPoller) {
      clearInterval(this.batchPoller);
      this.batchPoller = null;
    }
  }

  async listConversas(
    userId: string,
    params: ListConversasParams = {},
  ): Promise<PaginatedResult<any>> {
    const access = await this.getAccessContext(userId);
    const limit = this.clampPaginationLimit(params.limit, 25, 100);
    const offset = Math.max(0, params.offset || 0);
    const search = params.search?.trim() || '';
    const normalizedFilter = params.filter || 'all';
    const assignedUserId = params.assignedUserId || null;
    const whatsappConnectionId = params.whatsappConnectionId || null;

    const matchingContactIds = search
      ? await this.findConversationContactIds(access.effectiveAdminId, search)
      : null;

    const connectionJoin =
      normalizedFilter === 'deleted'
        ? 'whatsapp_connections!inner'
        : 'whatsapp_connections!inner';

    const query = this.supabaseService
      .getClient()
      .from('conversas')
      .select(
        `
        *,
        contatos (
          id,
          nome,
          whatsapp,
          avatar_url
        ),
        ${connectionJoin} (
          id,
          nome,
          numero,
          status,
          instance_name,
          cor,
          deleted_at,
          agente_id,
          conhecimento_id
        ),
        profile:assigned_user_id (
          auth_id,
          nome_completo,
          foto_perfil
        )
      `,
      )
      .eq('profile_id', access.effectiveAdminId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit);

    this.applyConnectionScope(query, access.allowedConnectionIds);

    if (whatsappConnectionId) {
      query.eq('whatsapp_connection_id', whatsappConnectionId);
    }

    if (normalizedFilter === 'deleted') {
      query.not('whatsapp_connections.deleted_at', 'is', null);
    } else {
      query.is('whatsapp_connections.deleted_at', null);
    }

    if (assignedUserId) {
      query.eq('assigned_user_id', assignedUserId);
    }

    if (normalizedFilter === 'mine') {
      query.eq('assigned_user_id', userId);
    } else if (normalizedFilter === 'unread') {
      query.gt('unread_count', 0);
    } else if (normalizedFilter === 'ai') {
      query.eq('ai_enabled', true);
    }

    if (search) {
      const filters = [`last_message_preview.ilike.%${search}%`];
      if (matchingContactIds?.length) {
        filters.push(`contato_id.in.(${matchingContactIds.join(',')})`);
      }
      query.or(filters.join(','));
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const items = await this.refreshConversationContactAvatars(data ?? []);

    return {
      hasMore: items.length > limit,
      items: items.slice(0, limit),
      nextOffset: items.length > limit ? offset + limit : null,
    };
  }

  async getConversationOptions(userId: string) {
    const access = await this.getAccessContext(userId);
    const client = this.supabaseService.getClient();

    const connectionsQuery = client
      .from('whatsapp_connections')
      .select('id, nome, numero, status')
      .eq('user_id', access.effectiveAdminId)
      .eq('status', 'connected')
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    this.applyConnectionScope(connectionsQuery, access.allowedConnectionIds, 'id');

    const { data: connections, error: connectionsError } = await connectionsQuery;
    if (connectionsError) {
      throw connectionsError;
    }

    const { data: contacts, error: contactsError } = await client
      .from('contatos')
      .select('id, nome, whatsapp, avatar_url')
      .eq('profile_id', access.effectiveAdminId)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (contactsError) {
      throw contactsError;
    }

    const assignedUsers = await this.listConversationAssignedUsers(
      access.effectiveAdminId,
    );

    return {
      assignedUsers,
      connections: connections ?? [],
      contacts: contacts ?? [],
    };
  }

  async getConversa(userId: string, conversaId: string) {
    const conversation = await this.getAccessibleConversa(userId, conversaId);
    return this.refreshConversationContactAvatar(conversation);
  }

  async listMensagens(
    userId: string,
    conversaId: string,
    params: ListMensagensParams = {},
  ): Promise<PaginatedResult<any>> {
    const conversa = await this.getAccessibleConversa(userId, conversaId);
    const limit = this.clampPaginationLimit(params.limit, 30, 100);
    const offset = Math.max(0, params.offset || 0);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('*')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      throw error;
    }

    const items = (data ?? []).slice(0, limit).reverse();

    return {
      hasMore: (data ?? []).length > limit,
      items,
      nextOffset: (data ?? []).length > limit ? offset + limit : null,
    };
  }

  async createConversa(userId: string, dto: CreateConversaDto) {
    const access = await this.getAccessContext(userId);
    await this.assertConnectionAccess(access, dto.whatsapp_connection_id);
    const contatoId = dto.contato_id
      ? await this.assertContatoAccess(access, dto.contato_id)
      : (
          await this.findOrCreateContact(
            access.effectiveAdminId,
            dto.contact_whatsapp || '',
            dto.contact_name?.trim() || null,
          )
        ).id;

    const client = this.supabaseService.getClient();

    const { data: existing } = await client
      .from('conversas')
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
          whatsapp_connections ( id, nome, numero, status, instance_name, cor, deleted_at ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .eq('profile_id', access.effectiveAdminId)
      .eq('contato_id', contatoId)
      .eq('whatsapp_connection_id', dto.whatsapp_connection_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      await this.touchContactConnectionPresence(
        access.effectiveAdminId,
        contatoId,
        dto.whatsapp_connection_id,
      );
      return this.refreshConversationContactAvatar(existing);
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from('conversas')
      .insert({
        profile_id: access.effectiveAdminId,
        contato_id: contatoId,
        whatsapp_connection_id: dto.whatsapp_connection_id,
        last_message_at: now,
        updated_at: now,
      })
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
          whatsapp_connections ( id, nome, numero, status, instance_name, cor, deleted_at ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .single();

    if (error || !data) {
      throw error;
    }

    await this.touchContactConnectionPresence(
      access.effectiveAdminId,
      contatoId,
      dto.whatsapp_connection_id,
    );

    return this.refreshConversationContactAvatar(data);
  }

  async markAsRead(userId: string, conversaId: string) {
    await this.getAccessibleConversa(userId, conversaId);

    const { error } = await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversaId);

    if (error) {
      throw error;
    }

    return { success: true };
  }

  async deleteConversa(userId: string, conversaId: string) {
    await this.getAccessibleConversa(userId, conversaId);

    const { error } = await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversaId);

    if (error) {
      throw error;
    }

    return { success: true };
  }

  async toggleAi(userId: string, conversaId: string, enabled: boolean) {
    const conversa = await this.getAccessibleConversa(userId, conversaId);
    this.assertClaimAccess(conversa, userId);

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        ai_enabled: enabled,
        ai_disabled_at: enabled ? null : now,
        updated_at: now,
      })
      .eq('id', conversaId)
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
          whatsapp_connections ( id, nome, numero, status, instance_name, cor, deleted_at ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .single();

    if (error || !data) {
      throw error;
    }

    return this.refreshConversationContactAvatar(data);
  }

  async sendMensagem(
    userId: string,
    conversaId: string,
    content: string,
    replyToMessageId?: string,
  ) {
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Informe a mensagem antes de enviar.');
    }

    const conversa = await this.getAccessibleConversa(userId, conversaId);
    this.assertManualReplyAllowed(conversa);

    const manualContext = await this.prepareManualOutboundContext(
      conversa,
      conversaId,
      userId,
      replyToMessageId,
    );

    const senderProfile = await this.getSenderProfilePreferences(userId);
    const outboundContent =
      senderProfile.mostra_nome_mensagens && senderProfile.nome_completo?.trim()
        ? `${senderProfile.nome_completo.trim()}:\n\n${trimmedContent}`
        : trimmedContent;

    const result = manualContext.replyPayload
      ? await this.evolutionApiService.sendTextMessageWithOptions(
          manualContext.connection.instance_name,
          {
            number: manualContext.normalizedNumber,
            quoted: manualContext.replyPayload,
            text: outboundContent,
          },
        )
      : await this.evolutionApiService.sendTextMessage(
          manualContext.connection.instance_name,
          manualContext.normalizedNumber,
          outboundContent,
        );

    if (!result) {
      throw new BadRequestException('Falha ao enviar a mensagem pelo WhatsApp.');
    }

    await this.persistManualOutboundMessage({
      content: outboundContent,
      conversation: manualContext.claimedConversa,
      messageType: 'text',
      rawPayload: result,
      replyToMessageId,
      senderUserId: userId,
    });

    return { success: true };
  }

  async sendMediaMessage(
    userId: string,
    conversaId: string,
    file: Express.Multer.File,
    caption?: string,
    replyToMessageId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Selecione um arquivo para enviar.');
    }

    const conversa = await this.getAccessibleConversa(userId, conversaId);
    this.assertManualReplyAllowed(conversa);
    const manualContext = await this.prepareManualOutboundContext(
      conversa,
      conversaId,
      userId,
      replyToMessageId,
    );

    const mimeType = file.mimetype || 'application/octet-stream';
    const base64 = file.buffer.toString('base64');

    const result = mimeType.startsWith('audio/')
      ? await this.evolutionApiService.sendWhatsAppAudio(
          manualContext.connection.instance_name,
          {
            audio: base64,
            number: manualContext.normalizedNumber,
            quoted: manualContext.replyPayload || undefined,
          },
        )
      : await this.evolutionApiService.sendMediaMessage(
          manualContext.connection.instance_name,
          {
            caption: caption?.trim() || undefined,
            fileName: file.originalname || `arquivo-${Date.now()}`,
            media: base64,
            mediatype: this.getOutboundMediaTypeFromMime(mimeType),
            mimetype: mimeType,
            number: manualContext.normalizedNumber,
            quoted: manualContext.replyPayload || undefined,
          },
        );

    if (!result) {
      throw new BadRequestException('Falha ao enviar o arquivo pelo WhatsApp.');
    }

    const uploadedMedia = await this.uploadMedia(
      manualContext.claimedConversa.profile_id,
      manualContext.claimedConversa.id,
      this.extractOutgoingMessageId(result),
      mimeType.startsWith('audio/') ? 'audio' : this.getMessageTypeFromMime(mimeType),
      mimeType,
      file.buffer,
    );

    await this.persistManualOutboundMessage({
      content: caption?.trim() || null,
      conversation: manualContext.claimedConversa,
      mediaMimeType: mimeType,
      mediaPath: uploadedMedia.path,
      mediaUrl: uploadedMedia.publicUrl,
      messageType: mimeType.startsWith('audio') ? 'audio' : this.getMessageTypeFromMime(mimeType),
      rawPayload: result,
      replyToMessageId,
      senderUserId: userId,
    });

    return { success: true };
  }

  async deleteMessage(userId: string, conversaId: string, messageId: string) {
    const conversation = await this.getAccessibleConversa(userId, conversaId);
    this.assertClaimAccess(conversation, userId);

    const { data: message, error } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('id, raw_payload, sender_type, direction, created_at')
      .eq('id', messageId)
      .eq('conversa_id', conversaId)
      .maybeSingle();

    if (error || !message) {
      throw new NotFoundException('Mensagem não encontrada.');
    }

    if (message.direction !== 'outbound') {
      throw new BadRequestException('Só é possível excluir mensagens enviadas por nós.');
    }

    if (Date.now() - new Date(message.created_at).getTime() > 48 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'A mensagem já passou da janela permitida para exclusão para todos.',
      );
    }

    const claimedConversa = await this.claimConversa(conversation, userId);
    const connection = this.unwrapRelation<{
      id: string;
      instance_name: string;
      status: string;
    }>(claimedConversa.whatsapp_connections);

    if (!connection?.instance_name || connection.status !== 'connected') {
      throw new BadRequestException('A conexão do WhatsApp não está ativa.');
    }

    const deletePayload = this.buildDeleteMessagePayload(message.raw_payload);
    if (!deletePayload) {
      throw new BadRequestException('Não foi possível montar os dados da mensagem para exclusão.');
    }

    const result = await this.evolutionApiService.deleteMessageForEveryone(
      connection.instance_name,
      deletePayload,
    );

    if (!result) {
      throw new BadRequestException('Falha ao excluir a mensagem para todos.');
    }

    await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .update({
        content: '[Mensagem excluída]',
        media_mime_type: null,
        media_path: null,
        media_url: null,
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    return { success: true };
  }

  private assertManualReplyAllowed(conversa: any) {
    const connection = this.unwrapRelation<any>(conversa?.whatsapp_connections);
    if (connection?.deleted_at) {
      throw new BadRequestException(
        'Nao e possivel enviar mensagens em conversas de conexoes excluidas.',
      );
    }

    if (conversa.ai_enabled) {
      throw new BadRequestException(
        'Desative a IA antes de responder manualmente.',
      );
    }

    if (!conversa.ai_disabled_at) {
      throw new BadRequestException(
        'A IA precisa ser desativada por pelo menos 1 minuto antes do envio manual.',
      );
    }

    const disabledAt = new Date(conversa.ai_disabled_at).getTime();
    if (Date.now() - disabledAt < 60_000) {
      throw new BadRequestException(
        'Aguarde 1 minuto após desativar a IA para assumir a conversa.',
      );
    }
  }

  private async prepareManualOutboundContext(
    conversa: any,
    conversaId: string,
    userId: string,
    replyToMessageId?: string,
  ) {
    const claimedConversa = await this.claimConversa(conversa, userId);
    const connection = this.unwrapRelation<{
      id: string;
      instance_name: string;
      nome: string;
      status: string;
    }>(claimedConversa.whatsapp_connections);
    const contact = this.unwrapRelation<{ id: string; whatsapp: string }>(
      claimedConversa.contatos,
    );

    if (!connection?.instance_name || connection.status !== 'connected') {
      throw new BadRequestException('A conexão do WhatsApp não está ativa.');
    }

    if (!contact?.whatsapp) {
      throw new BadRequestException('O contato não possui WhatsApp válido.');
    }

    const normalizedNumber = this.normalizeWhatsapp(contact.whatsapp);
    if (!normalizedNumber) {
      throw new BadRequestException('O número do contato é inválido.');
    }

    const replyPayload = replyToMessageId
      ? await this.buildQuotedPayload(conversaId, replyToMessageId)
      : null;

    return {
      claimedConversa,
      connection,
      normalizedNumber,
      replyPayload,
    };
  }

  private async buildQuotedPayload(conversaId: string, replyToMessageId: string) {
    const { data: message } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('id, raw_payload, content, ai_context_text')
      .eq('conversa_id', conversaId)
      .eq('id', replyToMessageId)
      .maybeSingle();

    const quotedId = this.extractOutgoingMessageId(message?.raw_payload);

    if (!quotedId) {
      return null;
    }

    return {
      key: {
        id: quotedId,
      },
      message: {
        conversation:
          message?.content ||
          message?.ai_context_text ||
          'Mensagem respondida via FLOW',
      },
    };
  }

  private extractOutgoingMessageId(result: any) {
    return result?.key?.id || result?.data?.key?.id || result?.id || null;
  }

  private getOutboundMediaTypeFromMime(mimeType: string) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private getMessageTypeFromMime(mimeType: string): 'audio' | 'image' | 'video' | 'unsupported' {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'unsupported';
  }

  private buildDeleteMessagePayload(rawPayload: any) {
    const key = rawPayload?.key || rawPayload?.data?.key || null;
    const remoteJid = key?.remoteJid || rawPayload?.remoteJid || rawPayload?.data?.remoteJid || null;

    if (!remoteJid || !key?.id) {
      return null;
    }

    return {
      fromMe: true,
      id: key.id,
      participant: key?.participant || rawPayload?.participant || undefined,
      remoteJid,
    };
  }

  private async persistManualOutboundMessage(params: {
    content: string | null;
    conversation: any;
    mediaMimeType?: string | null;
    mediaPath?: string | null;
    mediaUrl?: string | null;
    messageType: string;
    rawPayload: Record<string, unknown>;
    replyToMessageId?: string;
    senderUserId: string;
  }) {
    const now = new Date().toISOString();
    const messageId = this.extractOutgoingMessageId(params.rawPayload);

    const { error: messageError } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .insert({
        conversa_id: params.conversation.id,
        profile_id: params.conversation.profile_id,
        whatsapp_connection_id: params.conversation.whatsapp_connection_id,
        direction: 'outbound',
        sender_type: 'user',
        sender_user_id: params.senderUserId,
        message_type: params.messageType,
        content: params.content,
        media_mime_type: params.mediaMimeType || null,
        media_path: params.mediaPath || null,
        media_url: params.mediaUrl || null,
        raw_payload: params.rawPayload,
        status: 'sent',
        created_at: now,
        updated_at: now,
      });

    if (messageError) {
      throw messageError;
    }

    const preview =
      params.content ||
      this.getFallbackPreview(params.messageType);

    await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        assigned_user_id: params.senderUserId,
        assigned_at: params.conversation.assigned_at ?? now,
        human_intervention_requested_at: null,
        human_intervention_reason: null,
        last_attendant_alert_at: null,
        last_message_preview: preview,
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', params.conversation.id);
  }

  private async getSenderProfilePreferences(userId: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('profile')
      .select('nome_completo, mostra_nome_mensagens')
      .eq('auth_id', userId)
      .maybeSingle();

    return {
      mostra_nome_mensagens: data?.mostra_nome_mensagens ?? true,
      nome_completo: data?.nome_completo || '',
    };
  }

  async handleWhatsappWebhook(payload: any) {
    const event = this.normalizeWebhookEvent(payload?.event);

    if (!event.includes('messages.upsert')) {
      return { processed: false };
    }

    const instanceName = payload?.instance;
    if (!instanceName) {
      return { processed: false };
    }

    const connection = await this.findConnectionByInstance(instanceName);
    if (!connection) {
      return { processed: false };
    }

    const messageData = payload?.data || payload?.body?.data || null;
    if (this.isGroupMessage(messageData)) {
      this.logger.debug(
        `Ignorando mensagem de grupo para a instância ${connection.instance_name}.`,
      );
      return { processed: false, reason: 'group_message' };
    }

    if (this.isOwnWhatsappMessage(messageData)) {
      return this.handleOwnWhatsappMessage(connection, payload, messageData);
    }

    const incomingMessage = await this.extractIncomingMessage(connection, payload);
    if (!incomingMessage) {
      return { processed: false };
    }

    const contact = await this.findOrCreateContact(
      connection.user_id,
      incomingMessage.phone,
      incomingMessage.pushName,
      {
        instanceName: connection.instance_name,
        remoteJid: incomingMessage.remoteJid,
      },
    );

    const conversa = await this.findOrCreateConversa(
      connection.user_id,
      connection.id,
      contact.id,
    );

    await this.persistIncomingMessage(conversa, connection.id, incomingMessage);

    return { processed: true, conversaId: conversa.id };
  }

  private normalizeWebhookEvent(event: unknown) {
    return String(event || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '.');
  }

  private async persistIncomingMessage(
    conversa: any,
    connectionId: string,
    message: IncomingMessage,
  ) {
    const now = new Date().toISOString();
    const mediaUpload = message.mediaBuffer
      ? await this.uploadMedia(
          conversa.profile_id,
          conversa.id,
          this.extractOutgoingMessageId(message.rawPayload),
          message.messageType,
          message.mediaMimeType,
          message.mediaBuffer,
        )
      : null;

    const preview = message.content || this.getFallbackPreview(message.messageType);

    const { error: messageError } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .insert({
        conversa_id: conversa.id,
        profile_id: conversa.profile_id,
        whatsapp_connection_id: connectionId,
        direction: 'inbound',
        sender_type: 'customer',
        message_type: message.messageType,
        content: message.content,
        ai_context_text: message.aiContextText,
        media_url: mediaUpload?.publicUrl ?? null,
        media_path: mediaUpload?.path ?? null,
        media_mime_type: message.mediaMimeType,
        raw_payload: message.rawPayload,
        status: 'received',
        created_at: now,
        updated_at: now,
      });

    if (messageError) {
      throw messageError;
    }

    const { data: latestMessage, error: latestMessageError } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('id')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMessageError) {
      throw latestMessageError;
    }

    await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        last_message_preview: preview,
        last_message_at: now,
        unread_count: (conversa.unread_count ?? 0) + 1,
        updated_at: now,
      })
      .eq('id', conversa.id);

    if (latestMessage?.id) {
      await this.queueInboundBatch(conversa.id, conversa.profile_id, latestMessage.id);
    }
  }

  private async queueInboundBatch(
    conversaId: string,
    profileId: string,
    messageId: string,
  ) {
    const client = this.supabaseService.getClient();
    const { data: existingPending } = await client
      .from('conversas_lotes_recebimento')
      .select('id, message_ids')
      .eq('conversa_id', conversaId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      const nextMessageIds = Array.from(
        new Set([...(existingPending.message_ids || []), messageId]),
      );

      await client
        .from('conversas_lotes_recebimento')
        .update({
          message_ids: nextMessageIds,
          scheduled_for: new Date(Date.now() + 5_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPending.id);

      return;
    }

    const { data: existingProcessing } = await client
      .from('conversas_lotes_recebimento')
      .select('id')
      .eq('conversa_id', conversaId)
      .eq('status', 'processing')
      .maybeSingle();

    if (existingProcessing) {
      await client.from('conversas_lotes_recebimento').insert({
        conversa_id: conversaId,
        profile_id: profileId,
        message_ids: [messageId],
        scheduled_for: new Date(Date.now() + 5_000).toISOString(),
        status: 'pending',
      });
      return;
    }

    await client.from('conversas_lotes_recebimento').insert({
      conversa_id: conversaId,
      profile_id: profileId,
      message_ids: [messageId],
      scheduled_for: new Date(Date.now() + 5_000).toISOString(),
      status: 'pending',
    });
  }

  private async uploadMedia(
    profileId: string,
    conversaId: string,
    messageId: string | null,
    messageType: string,
    mimeType: string | null,
    fileBuffer: Buffer,
  ) {
    const extension = this.getFileExtension(messageType, mimeType);
    const safeMessageId = messageId || crypto.randomUUID();
    const path = `${profileId}/${conversaId}/${safeMessageId}.${extension}`;

    const { error } = await this.supabaseService
      .getClient()
      .storage.from('chat-media')
      .upload(path, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = this.supabaseService.getClient().storage.from('chat-media').getPublicUrl(path);

    return {
      path,
      publicUrl,
    };
  }

  private getFallbackPreview(messageType: string) {
    const labels: Record<string, string> = {
      audio: 'Audio recebido',
      image: 'Imagem recebida',
      sticker: 'Figurinha recebida',
      unsupported: 'Mensagem não suportada',
      video: 'Vídeo recebido',
    };

    return labels[messageType] || 'Nova mensagem';
  }

  private async claimConversa(conversa: any, userId: string) {
    if (
      conversa.assigned_user_id &&
      String(conversa.assigned_user_id) !== String(userId)
    ) {
      throw new ConflictException(
        'Esta conversa já está em atendimento por outro usuário.',
      );
    }

    if (String(conversa.assigned_user_id) === String(userId)) {
      return conversa;
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        assigned_user_id: userId,
        assigned_at: now,
        human_intervention_requested_at: null,
        human_intervention_reason: null,
        last_attendant_alert_at: null,
        updated_at: now,
      })
      .eq('id', conversa.id)
      .or(`assigned_user_id.is.null,assigned_user_id.eq.${userId}`)
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
          whatsapp_connections ( id, nome, numero, status, instance_name, cor, deleted_at ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .single();

    if (error || !data) {
      throw new ConflictException(
        'Não foi possível assumir esta conversa agora.',
      );
    }

    return data;
  }

  private assertClaimAccess(conversa: any, userId: string) {
    if (
      conversa.assigned_user_id &&
      String(conversa.assigned_user_id) !== String(userId)
    ) {
      throw new ForbiddenException(
        'Esta conversa está vinculada a outro usuário.',
      );
    }
  }

  private async getAccessibleConversa(userId: string, conversaId: string) {
    const access = await this.getAccessContext(userId);
    const query = this.supabaseService
      .getClient()
      .from('conversas')
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
          whatsapp_connections ( id, nome, numero, status, instance_name, cor, deleted_at ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
        )
      .eq('id', conversaId)
      .eq('profile_id', access.effectiveAdminId)
      .is('deleted_at', null);

    this.applyConnectionScope(query, access.allowedConnectionIds);

    const { data, error } = await query.single();

    if (error || !data) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    return data;
  }

  private async assertContatoAccess(access: AccessContext, contatoId: string) {
    if (!contatoId) {
      throw new BadRequestException('Selecione um contato para continuar.');
    }

    const { data } = await this.supabaseService
      .getClient()
        .from('contatos')
        .select('id')
        .eq('id', contatoId)
        .eq('profile_id', access.effectiveAdminId)
        .is('deleted_at', null)
        .maybeSingle();

    if (!data) {
      throw new NotFoundException('Contato não encontrado.');
    }

    return data.id;
  }

  private async assertConnectionAccess(
    access: AccessContext,
    whatsappConnectionId: string,
  ) {
    const query = this.supabaseService
      .getClient()
        .from('whatsapp_connections')
        .select('id')
        .eq('id', whatsappConnectionId)
        .eq('user_id', access.effectiveAdminId)
        .is('deleted_at', null);

    this.applyConnectionScope(query, access.allowedConnectionIds, 'id');
    const { data } = await query.maybeSingle();

    if (!data) {
      throw new ForbiddenException('Conexão de WhatsApp sem acesso.');
    }
  }

  private applyConnectionScope(
    query: any,
    allowedConnectionIds: string[] | null,
    field = 'whatsapp_connection_id',
  ) {
    if (allowedConnectionIds === null) {
      return query;
    }

    if (allowedConnectionIds.length === 0) {
      query.in(field, ['00000000-0000-0000-0000-000000000000']);
      return query;
    }

    query.in(field, allowedConnectionIds);
    return query;
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

    if (profile.tipo_de_usuario === 'atendente') {
      const { data: atendente } = await client
        .from('atendentes')
        .select('admin_id, whatsapp_ids')
        .eq('profile_id', userId)
        .single();

      if (!atendente) {
        throw new ForbiddenException('Atendente sem vínculo configurado.');
      }

      return {
        allowedConnectionIds: atendente.whatsapp_ids || [],
        effectiveAdminId: atendente.admin_id,
        isAtendente: true,
        userId,
      };
    }

    return {
      allowedConnectionIds: null,
      effectiveAdminId: userId,
      isAtendente: false,
      userId,
    };
  }

  private async listConversationAssignedUsers(adminId: string) {
    const client = this.supabaseService.getClient();
    const { data: adminProfile } = await client
      .from('profile')
      .select('auth_id, nome_completo')
      .eq('auth_id', adminId)
      .maybeSingle();

    const { data: attendantProfiles } = await client
      .from('atendentes')
      .select('profile:profile_id(auth_id, nome_completo)')
      .eq('admin_id', adminId);

    const options = [
      adminProfile,
      ...(attendantProfiles ?? []).map((row: any) => this.unwrapRelation(row.profile)),
    ].filter(Boolean);

    return Array.from(
      new Map(
        options.map((option: any) => [
          option.auth_id,
          {
            auth_id: option.auth_id,
            nome_completo: option.nome_completo || null,
          },
        ]),
      ).values(),
    );
  }

  private async findConversationContactIds(profileId: string, search: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('contatos')
      .select('id')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .or(`nome.ilike.%${search}%,whatsapp.ilike.%${search}%`)
      .limit(200);

    return (data ?? []).map((item) => item.id);
  }

  private async findConnectionByInstance(instanceName: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
        .select(
          'id, user_id, instance_name, nome, numero, agente_id, conhecimento_id, status',
        )
        .eq('instance_name', instanceName)
        .is('deleted_at', null)
        .maybeSingle();

    return data;
  }

  private async handleOwnWhatsappMessage(connection: any, payload: any, messageData: any) {
    const phone = this.extractOutgoingContactPhone(messageData, payload);
    if (!phone) {
      this.logger.debug(
        `Mensagem fromMe sem telefone identificável para a instância ${connection.instance_name}.`,
      );
      return { processed: false, reason: 'from_me_without_phone' };
    }

    const conversation = await this.findConversationByPhone(connection.user_id, connection.id, phone);
    if (!conversation) {
      this.logger.debug(
        `Mensagem fromMe sem conversa encontrada para ${phone} na instância ${connection.instance_name}.`,
      );
      return { processed: false, reason: 'from_me_without_conversation' };
    }

    const now = new Date().toISOString();
    await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        ai_disabled_at: now,
        ai_enabled: false,
        updated_at: now,
      })
      .eq('id', conversation.id);

    this.logger.debug(
      `IA desativada automaticamente por mensagem enviada fora da plataforma. conversa=${conversation.id} telefone=${phone}`,
    );

    return {
      aiDisabled: true,
      conversationId: conversation.id,
      processed: true,
      reason: 'from_me_auto_disable',
    };
  }

  private async extractIncomingMessage(connection: any, payload: any) {
    const messageData = payload?.data || payload?.body?.data || null;
    if (!messageData?.key || messageData.key.fromMe || this.isGroupMessage(messageData)) {
      return null;
    }

    const phone = this.extractIncomingPhone(messageData, payload);
    if (!phone) {
      await this.logsService.warn({
        action: 'conversas.handleWhatsappWebhook.extractPhone',
        context: ConversasService.name,
        message: `Nao foi possivel extrair o telefone real do remetente para a instancia ${connection.instance_name}.`,
        metadata: {
          instanceName: connection.instance_name,
          remoteJid: messageData.key.remoteJid || '[ausente]',
          remoteJidAlt: messageData.key.remoteJidAlt || '[ausente]',
        },
        user_id: connection.user_id,
      });
      return null;
    }

    const messageType = this.detectMessageType(messageData.message);
    let content = this.extractTextContent(messageData.message, messageType);
    let mediaBuffer: Buffer | null = null;
    const mediaMimeType: string | null = this.extractMimeType(
      messageData.message,
      messageType,
    );

    if (messageType !== 'text' && messageType !== 'unsupported') {
      const base64Payload =
        await this.evolutionApiService.getBase64FromMediaMessage(
          connection.instance_name,
          messageData,
          messageType === 'video',
        );

      const base64 = this.extractBase64MediaPayload(base64Payload);

      if (typeof base64 === 'string') {
        mediaBuffer = Buffer.from(base64, 'base64');
      }
    }

    if (!content && messageType === 'unsupported') {
      content = 'Mensagem não suportada';
    }

    const aiContextText = await this.buildAiContextFromIncomingMedia({
      content,
      mediaBuffer,
      mediaMimeType,
      messageType,
    });

    return {
      aiContextText,
      content,
      mediaBuffer,
      mediaMimeType,
      messageType,
      phone,
      pushName: payload?.data?.pushName || payload?.pushName || null,
      rawPayload: payload,
      remoteJid: this.extractRemoteJid(messageData, payload),
    } satisfies IncomingMessage;
  }

  private extractIncomingPhone(messageData: any, payload: any) {
    const candidates = [
      messageData?.key?.remoteJidAlt,
      messageData?.key?.participantAlt,
      messageData?.senderPn,
      messageData?.participantPn,
      payload?.senderPn,
      payload?.participantPn,
      payload?.data?.senderPn,
      payload?.data?.participantPn,
      payload?.sender?.phone,
      payload?.data?.sender?.phone,
      messageData?.key?.remoteJid,
      messageData?.key?.participant,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }

      if (candidate.includes('@lid')) {
        continue;
      }

      const normalized = this.normalizeWhatsapp(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private extractOutgoingContactPhone(messageData: any, payload: any) {
    const candidates = [
      messageData?.key?.remoteJidAlt,
      messageData?.key?.remoteJid,
      payload?.key?.remoteJid,
      payload?.data?.key?.remoteJid,
      payload?.recipient?.phone,
      payload?.data?.recipient?.phone,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }

      if (candidate.endsWith('@g.us') || candidate.includes('@lid')) {
        continue;
      }

      const normalized = this.normalizeWhatsapp(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private isOwnWhatsappMessage(messageData: any) {
    return Boolean(messageData?.key?.fromMe);
  }

  private isGroupMessage(messageData: any) {
    const candidate =
      messageData?.key?.remoteJid ||
      messageData?.key?.remoteJidAlt ||
      null;

    return typeof candidate === 'string' && candidate.endsWith('@g.us');
  }

  private detectMessageType(message: any): IncomingMessage['messageType'] {
    if (!message) return 'unsupported';
    if (message.conversation || message.extendedTextMessage?.text) return 'text';
    if (message.audioMessage) return 'audio';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.stickerMessage) return 'sticker';
    return 'unsupported';
  }

  private extractTextContent(
    message: any,
    messageType: IncomingMessage['messageType'],
  ) {
    if (messageType === 'text') {
      return (
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        null
      );
    }

    if (messageType === 'image') {
      return message?.imageMessage?.caption || null;
    }

    if (messageType === 'video') {
      return message?.videoMessage?.caption || null;
    }

    return null;
  }

  private extractMimeType(
    message: any,
    messageType: IncomingMessage['messageType'],
  ) {
    const mimeMap: Record<string, string | null> = {
      audio: message?.audioMessage?.mimetype || 'audio/ogg',
      image: message?.imageMessage?.mimetype || 'image/jpeg',
      sticker: message?.stickerMessage?.mimetype || 'image/webp',
      unsupported: null,
      text: null,
      video: message?.videoMessage?.mimetype || 'video/mp4',
    };

    return mimeMap[messageType] ?? null;
  }

  private async findOrCreateContact(
    profileId: string,
    phone: string,
    pushName: string | null,
    options?: {
      instanceName?: string | null;
      remoteJid?: string | null;
    },
  ) {
    const normalizedPhone = this.normalizeWhatsapp(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Informe um WhatsApp válido para iniciar a conversa.');
    }

    const nextAvatarUrl = options?.instanceName
      ? await this.resolveContactAvatarUrl(
          options.instanceName,
          normalizedPhone,
          options.remoteJid || null,
        )
      : null;

    const client = this.supabaseService.getClient();
    const { data: existing } = await client
      .from('contatos')
      .select('id, nome, whatsapp, avatar_url')
      .eq('profile_id', profileId)
      .eq('whatsapp', normalizedPhone)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      if (nextAvatarUrl && nextAvatarUrl !== existing.avatar_url) {
        const { data: updated, error: updateError } = await client
          .from('contatos')
          .update({
            avatar_url: nextAvatarUrl,
            nome: pushName || existing.nome || normalizedPhone,
          })
          .eq('id', existing.id)
          .select('id, nome, whatsapp, avatar_url')
          .single();

        if (updateError || !updated) {
          throw updateError;
        }

        return updated;
      }

      return existing;
    }

    const { data: deletedExisting } = await client
      .from('contatos')
      .select('id, nome, whatsapp, avatar_url')
      .eq('profile_id', profileId)
      .eq('whatsapp', normalizedPhone)
      .not('deleted_at', 'is', null)
      .maybeSingle();

    if (deletedExisting) {
      const { data: restored, error: restoreError } = await client
        .from('contatos')
        .update({
          avatar_url: nextAvatarUrl || deletedExisting.avatar_url || null,
          nome: pushName || deletedExisting.nome || normalizedPhone,
          deleted_at: null,
        })
        .eq('id', deletedExisting.id)
        .select('id, nome, whatsapp, avatar_url')
        .single();

      if (restoreError || !restored) {
        throw restoreError;
      }

      return restored;
    }

    const { data, error } = await client
      .from('contatos')
      .insert({
        avatar_url: nextAvatarUrl,
        profile_id: profileId,
        nome: pushName || normalizedPhone,
        whatsapp: normalizedPhone,
      })
      .select('id, nome, whatsapp, avatar_url')
      .single();

    if (error || !data) {
      throw error;
    }

    return data;
  }

  private async findOrCreateConversa(
    profileId: string,
    connectionId: string,
    contatoId: string,
  ) {
    const client = this.supabaseService.getClient();
      const { data: existing } = await client
        .from('conversas')
        .select('*')
        .eq('profile_id', profileId)
        .eq('whatsapp_connection_id', connectionId)
        .eq('contato_id', contatoId)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing) {
      await this.touchContactConnectionPresence(profileId, contatoId, connectionId);
      return existing;
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from('conversas')
      .insert({
        profile_id: profileId,
        contato_id: contatoId,
        whatsapp_connection_id: connectionId,
        last_message_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error;
    }

    await this.touchContactConnectionPresence(profileId, contatoId, connectionId);

    return data;
  }

  private async touchContactConnectionPresence(
    profileId: string,
    contatoId: string,
    connectionId: string,
  ) {
    const now = new Date().toISOString();
    const { error } = await this.supabaseService
      .getClient()
      .from('contatos_whatsapp_connections')
      .upsert(
        {
          profile_id: profileId,
          contato_id: contatoId,
          whatsapp_connection_id: connectionId,
          last_seen_at: now,
          updated_at: now,
        },
        {
          onConflict: 'contato_id,whatsapp_connection_id',
        },
      );

    if (error) {
      throw error;
    }
  }

  private async findConversationByPhone(
    profileId: string,
    connectionId: string,
    phone: string,
  ) {
    const normalizedPhone = this.normalizeWhatsapp(phone);
    if (!normalizedPhone) {
      return null;
    }

    const { data: directData } = await this.supabaseService
      .getClient()
      .from('conversas')
      .select('id, contato_id, contatos!inner(whatsapp)')
      .eq('profile_id', profileId)
      .eq('whatsapp_connection_id', connectionId)
      .eq('contatos.whatsapp', normalizedPhone)
      .is('deleted_at', null)
      .maybeSingle();

    return directData;
  }

  private async processPendingBatches() {
    if (this.isProcessingBatches) {
      return;
    }

    this.isProcessingBatches = true;

    try {
      const client = this.supabaseService.getClient();
      const now = new Date().toISOString();
      const { data: dueBatches, error } = await client
        .from('conversas_lotes_recebimento')
        .select('id, conversa_id, profile_id, message_ids, scheduled_for, status')
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(5);

      if (error || !dueBatches?.length) {
        return;
      }

      for (const batch of dueBatches as ConversationBatch[]) {
        const claimed = await this.claimBatch(batch.id);
        if (!claimed) {
          continue;
        }

        await this.processSingleBatch(claimed);
      }
    } catch (error) {
      await this.logsService.error({
        action: 'conversas.processPendingBatches',
        context: ConversasService.name,
        error,
        message: 'Erro ao processar lotes de conversas',
      });
    } finally {
      this.isProcessingBatches = false;
    }
  }

  private async claimBatch(batchId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas_lotes_recebimento')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('status', 'pending')
      .select('id, conversa_id, profile_id, message_ids, scheduled_for, status')
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as ConversationBatch;
  }

  private async processSingleBatch(batch: ConversationBatch) {
    try {
      this.logAutomationDebug(batch.id, 'batch.start', {
        conversaId: batch.conversa_id,
        inboundMessageCount: batch.message_ids.length,
      });

      const conversation = await this.loadConversationForAutomation(batch.conversa_id);
      if (!conversation) {
        this.logAutomationDebug(batch.id, 'batch.skip', { reason: 'conversation_not_found' });
        await this.finishBatch(batch.id);
        return;
      }

      if (!conversation.ai_enabled) {
        this.logAutomationDebug(batch.id, 'batch.skip', { reason: 'ai_disabled' });
        await this.finishBatch(batch.id);
        return;
      }

      const connection = this.unwrapRelation<{
        id: string;
        nome: string;
        numero: string | null;
        status: string;
        instance_name: string;
        agente_id: string | null;
        conhecimento_id: string | null;
        business_hours?: {
          timezone?: string;
          days?: Record<string, Array<{ start: string; end: string }>>;
        } | null;
        appointment_slot_minutes?: number | null;
      }>(conversation.whatsapp_connections);
      const contact = this.unwrapRelation<{
        id: string;
        nome: string;
        whatsapp: string;
      }>(conversation.contatos);

      if (!connection?.instance_name || !contact) {
        this.logAutomationDebug(batch.id, 'batch.skip', {
          hasContact: Boolean(contact),
          hasInstanceName: Boolean(connection?.instance_name),
          reason: 'missing_connection_or_contact',
        });
        await this.finishBatch(batch.id);
        return;
      }

      const connectionValidation = await this.validateAutomationConnection(connection);
      if (!connectionValidation.connected) {
        this.logAutomationDebug(batch.id, 'batch.skip', {
          connectionStatus: connection.status,
          liveState: connectionValidation.liveState,
          reason: 'whatsapp_not_connected',
        });
        await this.finishBatch(batch.id);
        return;
      }

      const number = this.normalizeWhatsapp(contact.whatsapp);
      if (!number) {
        this.logAutomationDebug(batch.id, 'batch.skip', {
          contactWhatsapp: contact.whatsapp,
          reason: 'invalid_contact_number',
        });
        await this.finishBatch(batch.id);
        return;
      }

      const { data: inboundMessages, error: messagesError } = await this.supabaseService
        .getClient()
        .from('conversas_mensagens')
        .select(
          'id, direction, sender_type, message_type, content, ai_context_text, media_url, created_at',
        )
        .in('id', batch.message_ids)
        .order('created_at', { ascending: true });

      if (messagesError || !inboundMessages?.length) {
        this.logAutomationDebug(batch.id, 'batch.skip', {
          messageIds: batch.message_ids,
          reason: 'no_inbound_messages',
        });
        await this.finishBatch(batch.id);
        return;
      }

      const preferences = await this.getAutomationPreferences(conversation.profile_id);
      const contextAgentOutput = await this.runConversationContextAgent({
        batchId: batch.id,
        conversationId: batch.conversa_id,
        inboundMessages,
      });

      const schedulingResult = await this.handleSchedulingAutomation({
        contactId: contact.id,
        contactName: contact.nome,
        conversation,
        conversationId: batch.conversa_id,
        inboundMessages,
        preferences,
        profileId: conversation.profile_id,
        slotMinutes: connection.appointment_slot_minutes || 60,
        whatsappBusinessHours: connection.business_hours || {
          timezone: 'America/Sao_Paulo',
          days: {},
        },
      });

      if (schedulingResult) {
        this.logAutomationDebug(batch.id, 'scheduler.handled', {
          parts: schedulingResult.parts.length,
        });
        await this.sendReplyParts({
          batchId: batch.id,
          connectionId: connection.id,
          conversationId: batch.conversa_id,
          instanceName: connection.instance_name,
          number,
          parts: schedulingResult.parts,
          profileId: conversation.profile_id,
          sendErrorMessage: 'Falha ao enviar a resposta automatica de agendamento.',
        });
        await this.finishBatch(batch.id);
        return;
      }

      const knowledgeAgentOutput = await this.runKnowledgeAgent({
        batchId: batch.id,
        conhecimentoId: connection.conhecimento_id,
        conversationContext: contextAgentOutput.query,
      });
      const agentProfile = await this.runAgentProfileStage({
        agenteId: connection.agente_id,
        batchId: batch.id,
      });

      const draftReply = await this.generateConversationReply({
        agentProfile,
        connectionName: connection.nome,
        contactName: contact.nome,
        contextSummary: contextAgentOutput.summary,
        inboundMessages,
        knowledgeContext: knowledgeAgentOutput.knowledgeContext,
        preferences,
        recentHistory: contextAgentOutput.recentHistory,
      });

      const reviewedReply = await this.runReplyReviewAgent({
        agentProfile,
        batchId: batch.id,
        contactName: contact.nome,
        draftReply,
        knowledgeContext: knowledgeAgentOutput.knowledgeContext,
      });

      await this.sendReplyParts({
        batchId: batch.id,
        connectionId: connection.id,
        conversationId: batch.conversa_id,
        instanceName: connection.instance_name,
        number,
        parts: reviewedReply.parts,
        profileId: conversation.profile_id,
        sendErrorMessage: 'Falha ao enviar a resposta automática pelo WhatsApp.',
      });

      if (reviewedReply.shouldHandoff) {
        this.logAutomationDebug(batch.id, 'handoff.requested', {
          reason: reviewedReply.handoffReason,
        });
        await this.registerHandoff({
          alertAlreadySentAt: conversation.last_attendant_alert_at,
          assignedUserId: conversation.assigned_user_id,
          connectionInstanceName: connection.instance_name,
          connectionName: connection.nome,
          conversationId: batch.conversa_id,
          contactName: contact.nome,
          contactPhone: contact.whatsapp,
          profileId: conversation.profile_id,
          preferenceEnabled: preferences.alerta_atendentes_intervencao_ia,
          requestedAt: conversation.human_intervention_requested_at,
          reason: reviewedReply.handoffReason,
          whatsappConnectionId: connection.id,
        });
      }

      this.logAutomationDebug(batch.id, 'batch.completed', {
        partsSent: reviewedReply.parts.length,
        shouldHandoff: reviewedReply.shouldHandoff,
      });
      await this.finishBatch(batch.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logAutomationDebug(batch.id, 'batch.error', { error: message });
      this.logsService.createLog({
        level: 'error',
        action: 'conversas.processSingleBatch',
        message,
        metadata: { batchId: batch.id, conversaId: batch.conversa_id },
        user_id: batch.profile_id,
      });

      await this.finishBatch(batch.id, message);
    }
  }

  private async loadConversationForAutomation(conversaId: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('conversas')
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
        whatsapp_connections (
          id,
          nome,
          numero,
          status,
          instance_name,
          cor,
          agente_id,
          conhecimento_id,
          business_hours,
          appointment_slot_minutes
        ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
        `,
      )
      .eq('id', conversaId)
      .is('deleted_at', null)
      .maybeSingle();

    return data;
  }

  private async validateAutomationConnection(connection: {
    id: string;
    instance_name: string;
    status: string;
  }) {
    const liveStatus = await this.evolutionApiService.getInstanceStatus(
      connection.instance_name,
    );
    const liveState = this.normalizeEvolutionConnectionState(liveStatus);
    const connected = connection.status === 'connected' && liveState === 'connected';

    this.logAutomationDebug(connection.id, 'connection.validation', {
      dbStatus: connection.status,
      instanceName: connection.instance_name,
      liveState,
    });

    if (!connected && connection.status === 'connected') {
      await this.supabaseService
        .getClient()
        .from('whatsapp_connections')
        .update({
          status: liveState === 'connecting' ? 'connecting' : 'disconnected',
          ultima_atualizacao: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    return {
      connected,
      liveState,
    };
  }

  private async getRecentConversationHistory(conversaId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('direction, sender_type, message_type, content, ai_context_text, created_at')
      .eq('conversa_id', conversaId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(80);

    return data ?? [];
  }

  private async runConversationContextAgent(params: {
    batchId: string;
    conversationId: string;
    inboundMessages: Array<{
      ai_context_text: string | null;
      content: string | null;
      created_at: string;
      direction: string;
      id: string;
      media_url: string | null;
      message_type: string;
      sender_type: string;
    }>;
  }) {
    this.logAutomationDebug(params.batchId, 'agent1.context.start');
    const recentHistory = await this.getRecentConversationHistory(params.conversationId);
    const query = params.inboundMessages
      .map((message) => this.buildMessageContextText(message.message_type, message.content, message.ai_context_text))
      .join('\n');
    const summary = recentHistory
      .map((message) => {
        const sender =
          message.sender_type === 'customer'
            ? 'cliente'
            : message.sender_type === 'assistant'
              ? 'ia'
              : message.sender_type === 'user'
                ? 'atendente'
                : 'sistema';

        return `[${sender} | ${message.created_at}] ${this.buildMessageContextText(
          message.message_type,
          message.content,
          message.ai_context_text,
        )}`;
      })
      .join('\n');

    this.logAutomationDebug(params.batchId, 'agent1.context.done', {
      historyMessages: recentHistory.length,
      queryLength: query.length,
    });

    return {
      query,
      recentHistory,
      summary,
    };
  }

  private async getAgentProfile(agenteId: string | null) {
    if (!agenteId) {
      return null;
    }

    const { data } = await this.supabaseService
      .getClient()
      .from('agentes_ia')
      .select('id, nome, descricao, system_prompt')
      .eq('id', agenteId)
      .maybeSingle();

    return data;
  }

  private async runKnowledgeAgent(params: {
    batchId: string;
    conhecimentoId: string | null;
    conversationContext: string;
  }) {
    this.logAutomationDebug(params.batchId, 'agent2.knowledge.start', {
      conhecimentoId: params.conhecimentoId,
    });
    const knowledgeContext = await this.getKnowledgeContext(
      params.conhecimentoId,
      params.conversationContext,
    );
    this.logAutomationDebug(params.batchId, 'agent2.knowledge.done', {
      hasKnowledge: Boolean(knowledgeContext.trim()),
      knowledgeLength: knowledgeContext.length,
    });

    return {
      knowledgeContext,
    };
  }

  private async runAgentProfileStage(params: {
    agenteId: string | null;
    batchId: string;
  }) {
    this.logAutomationDebug(params.batchId, 'agent3.profile.start', {
      agenteId: params.agenteId,
    });
    const agentProfile = await this.getAgentProfile(params.agenteId);
    this.logAutomationDebug(params.batchId, 'agent3.profile.done', {
      hasAgentProfile: Boolean(agentProfile),
    });
    return agentProfile;
  }

  private async getAttendantAlertNumbers(
    adminId: string,
    whatsappConnectionId: string,
  ) {
    const { data } = await this.supabaseService
      .getClient()
      .from('atendentes')
      .select('numero')
      .eq('admin_id', adminId)
      .contains('whatsapp_ids', [whatsappConnectionId]);

    return (data ?? [])
      .map((row) => this.normalizeWhatsapp(row.numero))
      .filter((value): value is string => Boolean(value));
  }

  private async getAutomationPreferences(profileId: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('profile')
      .select('agendamento_automatico_ia, alerta_atendentes_intervencao_ia')
      .eq('auth_id', profileId)
      .maybeSingle();

    return {
      agendamento_automatico_ia: data?.agendamento_automatico_ia ?? true,
      alerta_atendentes_intervencao_ia:
        data?.alerta_atendentes_intervencao_ia ?? true,
    };
  }

  private async handleSchedulingAutomation(params: {
    contactId: string;
    contactName: string;
    conversation: any;
    conversationId: string;
    inboundMessages: Array<{
      ai_context_text: string | null;
      content: string | null;
      created_at: string;
      direction: string;
      id: string;
      media_url: string | null;
      message_type: string;
      sender_type: string;
    }>;
    preferences: {
      agendamento_automatico_ia: boolean;
      alerta_atendentes_intervencao_ia: boolean;
    };
    profileId: string;
    slotMinutes: number;
    whatsappBusinessHours: {
      timezone?: string;
      days?: Record<string, Array<{ start: string; end: string }>>;
    };
  }) {
    if (!params.preferences.agendamento_automatico_ia) {
      return null;
    }

    const hasBusinessHours =
      Object.values(params.whatsappBusinessHours.days || {}).flat().length > 0;
    if (!hasBusinessHours) {
      return null;
    }

    const pendingScheduleExpired =
      params.conversation.pending_schedule_expires_at &&
      new Date(params.conversation.pending_schedule_expires_at).getTime() <=
        Date.now();
    const pendingOptions = !pendingScheduleExpired &&
      Array.isArray(params.conversation.pending_schedule_options)
      ? params.conversation.pending_schedule_options
      : [];

    if (pendingScheduleExpired) {
      await this.supabaseService.getClient().from('conversas').update({
        pending_schedule_context: null,
        pending_schedule_expires_at: null,
        pending_schedule_options: null,
        updated_at: new Date().toISOString(),
      }).eq('id', params.conversationId);
    }

    const latestCustomerText = params.inboundMessages
      .map((message) =>
        this.buildMessageContextText(
          message.message_type,
          message.content,
          message.ai_context_text,
        ),
      )
      .join('\n');

    const schedulingDecision = await this.detectSchedulingIntent({
      contactName: params.contactName,
      latestCustomerText,
      pendingOptions,
    });

    if (schedulingDecision.intent === 'none') {
      return null;
    }

    if (schedulingDecision.intent === 'confirm' && pendingOptions.length > 0) {
      const selectedOption = pendingOptions.find((option: any) => {
        return option.startAt === schedulingDecision.selectedStartAt;
      });

      if (!selectedOption) {
        return {
          parts: [
            'Nao consegui identificar qual horario voce escolheu.',
            'Posso te reenviar as opcoes disponiveis para confirmar certinho.',
          ],
        };
      }

      try {
        const created = await this.agendamentosService.createAutomaticAgendamento({
          contatoId: params.contactId,
          dataHora: selectedOption.startAt,
          dataHoraFim: selectedOption.endAt,
          descricao: 'Agendamento confirmado automaticamente via WhatsApp.',
          profileId: params.profileId,
          status: 'confirmado',
          titulo:
            schedulingDecision.title ||
            params.conversation.pending_schedule_context?.title ||
            `Agendamento - ${params.contactName}`,
        });

        await this.supabaseService.getClient().from('conversas').update({
          last_message_at: new Date().toISOString(),
          pending_schedule_context: null,
          pending_schedule_expires_at: null,
          pending_schedule_options: null,
          updated_at: new Date().toISOString(),
        }).eq('id', params.conversationId);

        return {
          parts: [
            `Perfeito, deixei confirmado para ${selectedOption.label}.`,
            created.google_event_id
              ? 'O horario tambem ja foi sincronizado com a agenda do estabelecimento.'
              : 'O compromisso ja ficou registrado aqui na plataforma.',
          ],
        };
      } catch {
        const refreshedSlots = await this.agendamentosService.getAvailableSlots({
          businessHours: params.whatsappBusinessHours,
          daysAhead: 7,
          profileId: params.profileId,
          slotMinutes: params.slotMinutes,
        });

        await this.supabaseService.getClient().from('conversas').update({
          pending_schedule_context: {
            requestedAt: new Date().toISOString(),
            title:
              schedulingDecision.title ||
              params.conversation.pending_schedule_context?.title ||
              `Agendamento - ${params.contactName}`,
          },
          pending_schedule_expires_at: new Date(
            Date.now() + 4 * 60 * 60 * 1000,
          ).toISOString(),
          pending_schedule_options: refreshedSlots.slice(0, 4),
          updated_at: new Date().toISOString(),
        }).eq('id', params.conversationId);

        return {
          parts: [
            'Esse horario acabou de ficar indisponivel.',
            refreshedSlots.length
              ? `Posso te oferecer estas novas opcoes:\n${refreshedSlots
                  .slice(0, 4)
                  .map((slot, index) => `${index + 1}. ${slot.label}`)
                  .join('\n')}`
              : 'No momento nao encontrei outro horario livre nos proximos dias.',
          ],
        };
      }
    }

    if (schedulingDecision.intent === 'ask_availability') {
      const slots = await this.agendamentosService.getAvailableSlots({
        businessHours: params.whatsappBusinessHours,
        daysAhead: 7,
        profileId: params.profileId,
        slotMinutes: params.slotMinutes,
      });

      if (!slots.length) {
        return {
          parts: [
            'No momento nao encontrei horarios livres nos proximos dias.',
            'Se quiser, posso encaminhar seu pedido para a equipe confirmar outra opcao.',
          ],
        };
      }

      const selectedSlots = slots.slice(0, 4);
      await this.supabaseService.getClient().from('conversas').update({
        pending_schedule_context: {
          requestedAt: new Date().toISOString(),
          title:
            schedulingDecision.title || `Agendamento - ${params.contactName}`,
        },
        pending_schedule_expires_at: new Date(
          Date.now() + 4 * 60 * 60 * 1000,
        ).toISOString(),
        pending_schedule_options: selectedSlots,
        updated_at: new Date().toISOString(),
      }).eq('id', params.conversationId);

      return {
        parts: [
          'Posso te oferecer estes horarios disponiveis:',
          selectedSlots
            .map(
              (slot, index) =>
                `${index + 1}. ${slot.label}`,
            )
            .join('\n'),
          'Se algum funcionar para voce, me diga qual prefere e eu confirmo por aqui.',
        ],
      };
    }

    return null;
  }

  private async detectSchedulingIntent(params: {
    contactName: string;
    latestCustomerText: string;
    pendingOptions: Array<{ label?: string; startAt?: string }>;
  }) {
    const directSelection = this.matchPendingScheduleSelection(
      params.latestCustomerText,
      params.pendingOptions,
    );

    if (directSelection) {
      return {
        intent: 'confirm' as const,
        selectedStartAt: directSelection.startAt,
        title: null,
      };
    }

    const completion = await this.openai.chat.completions.create({
      model: this.responseModel,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Analise a mensagem do cliente para detectar intencao de agendamento.
Retorne JSON:
{
  "intent": "none" | "ask_availability" | "confirm",
  "selectedStartAt": "iso-or-null",
  "title": "titulo-curto-ou-null"
}
Use "ask_availability" quando o cliente quiser marcar, agendar, reservar horario, consulta ou visita.
Use "confirm" apenas quando ele claramente escolher uma das opcoes pendentes.
Se houver opcoes pendentes, escolha selectedStartAt apenas entre elas.`,
        },
        {
          role: 'user',
          content: `Cliente: ${params.contactName}
Mensagem atual:
${params.latestCustomerText}

Opcoes pendentes:
${params.pendingOptions
  .map((option) => `- ${option.label} | ${option.startAt}`)
  .join('\n') || 'nenhuma'}
`,
        },
      ],
    });

    try {
      const parsed = JSON.parse(
        completion.choices[0]?.message?.content || '{}',
      ) as {
        intent?: 'none' | 'ask_availability' | 'confirm';
        selectedStartAt?: string | null;
        title?: string | null;
      };

      return {
        intent: parsed.intent || 'none',
        selectedStartAt: parsed.selectedStartAt || null,
        title: parsed.title || null,
      };
    } catch {
      return {
        intent: 'none' as const,
        selectedStartAt: null,
        title: null,
      };
    }
  }

  private matchPendingScheduleSelection(
    latestCustomerText: string,
    pendingOptions: Array<{ label?: string; startAt?: string }>,
  ) {
    if (!pendingOptions.length) {
      return null;
    }

    const normalizedText = this.normalizeLooseText(latestCustomerText);
    if (!normalizedText) {
      return null;
    }

    const directIndexMatch = normalizedText.match(/\b([1-9]|10)\b/);
    if (directIndexMatch) {
      const selectedIndex = Number(directIndexMatch[1]) - 1;
      if (pendingOptions[selectedIndex]?.startAt) {
        return pendingOptions[selectedIndex];
      }
    }

    for (const option of pendingOptions) {
      const normalizedLabel = this.normalizeLooseText(option.label || '');
      if (normalizedLabel && normalizedText.includes(normalizedLabel)) {
        return option;
      }

      if (option.startAt) {
        const parsedDate = new Date(option.startAt);
        if (!Number.isNaN(parsedDate.getTime())) {
          const hourMinute = `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`;
          if (normalizedText.includes(this.normalizeLooseText(hourMinute))) {
            return option;
          }
        }
      }
    }

    return null;
  }

  private async getKnowledgeContext(conhecimentoId: string | null, query: string) {
    if (!conhecimentoId || !query.trim()) {
      return '';
    }

    const { data: knowledge } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .select('titulo, descricao, resumo')
      .eq('id', conhecimentoId)
      .maybeSingle();

    const { data: chunks } = await this.supabaseService
      .getClient()
      .from('conhecimento_chunks')
      .select('content, embedding')
      .eq('conhecimento_id', conhecimentoId)
      .limit(120);

    if (!chunks?.length) {
      return [knowledge?.titulo, knowledge?.descricao, knowledge?.resumo]
        .filter(Boolean)
        .join('\n\n');
    }

    const queryEmbedding = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: query,
    });

    const vector = queryEmbedding.data[0]?.embedding || [];
    const ranked = chunks
      .map((chunk) => {
        try {
          const parsed = JSON.parse(String(chunk.embedding || '[]')) as number[];
          return {
            content: chunk.content,
            score: this.cosineSimilarity(vector, parsed),
          };
        } catch {
          return {
            content: chunk.content,
            score: 0,
          };
        }
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((chunk) => chunk.content);

    return [knowledge?.titulo, knowledge?.descricao, knowledge?.resumo, ...ranked]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generateConversationReply(params: {
    agentProfile: any;
    connectionName: string;
    contactName: string;
    contextSummary: string;
    inboundMessages: Array<{
      ai_context_text: string | null;
      content: string | null;
      created_at: string;
      direction: string;
      id: string;
      media_url: string | null;
      message_type: string;
      sender_type: string;
    }>;
    knowledgeContext: string;
    preferences: {
      agendamento_automatico_ia: boolean;
      alerta_atendentes_intervencao_ia: boolean;
    };
      recentHistory: Array<{
      ai_context_text: string | null;
      content: string | null;
      created_at: string;
      direction: string;
      message_type: string;
      sender_type: string;
    }>;
  }): Promise<AutomationReply> {
    const groupedInbound = params.inboundMessages
      .map((message) => {
        return `- ${this.buildMessageContextText(message.message_type, message.content, message.ai_context_text)}`;
      })
      .join('\n');

      const systemPrompt = `
Você é o agente de WhatsApp da FLOW para conversas reais com clientes.
Responda em pt-BR, com tom natural, humano, breve e útil.
Use o perfil do agente e o conhecimento como fontes principais.
Se a base de conhecimento trouxer regras, gatilhos ou orientacoes sobre quando acionar um humano, siga essas regras com prioridade.
Se houver necessidade clara de ação humana, cobrança, negociação especial, caso técnico delicado, insatisfação forte, urgência ou ausência de informação confiável, sinalize handoff.
Nunca invente fatos.
Sempre responda no formato JSON:
{
  "parts": ["parte 1", "parte 2"],
  "shouldHandoff": false,
  "handoffReason": null
}
Regras para parts:
- Gere de 1 a 4 partes curtas.
- Quebre naturalmente, como mensagens humanas separadas.
- Não use markdown.
- Evite repetir saudação.
- Se já existir histórico recente, continue a conversa exatamente de onde ela parou.
- Não reinicie o atendimento com "oi", "olá", apresentação ou saudação nova se o cliente já recebeu resposta antes.
- Considere o histórico recente como contexto obrigatório antes de responder.
- Se a entrada mais recente for uma figurinha sem contexto adicional, responda de forma leve e amigável, sem inventar significado específico.

Perfil do agente:
${params.agentProfile?.system_prompt || params.agentProfile?.descricao || 'Atendimento cordial e objetivo.'}

Contexto da conexão:
- Nome da conexão: ${params.connectionName}
- Nome do cliente: ${params.contactName}

Base de conhecimento relevante:
${params.knowledgeContext || 'Sem base de conhecimento adicional.'}

Histórico da última semana:
${params.contextSummary || 'Sem histórico recente.'}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.responseModel,
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Mensagens novas agrupadas do cliente:\n${groupedInbound}`,
        },
      ],
    });

    const fallback = {
      handoffReason: null,
      parts: ['Perfeito, já estou verificando isso para você.'],
      shouldHandoff: false,
    };

    try {
      const parsed = JSON.parse(
        completion.choices[0]?.message?.content || JSON.stringify(fallback),
      ) as {
        handoffReason?: string | null;
        parts?: string[];
        shouldHandoff?: boolean;
      };

      const parts = (parsed.parts || [])
        .flatMap((part) => this.normalizeAssistantParts(part))
        .filter(Boolean)
        .slice(0, 4);

      return {
        handoffReason: parsed.handoffReason || null,
        parts: parts.length ? parts : fallback.parts,
        shouldHandoff: Boolean(parsed.shouldHandoff),
      };
    } catch {
      return fallback;
    }
  }

  private async runReplyReviewAgent(params: {
    agentProfile: any;
    batchId: string;
    contactName: string;
    draftReply: AutomationReply;
    knowledgeContext: string;
  }): Promise<AutomationReply> {
    this.logAutomationDebug(params.batchId, 'agent4.review.start', {
      draftParts: params.draftReply.parts.length,
      shouldHandoff: params.draftReply.shouldHandoff,
    });

    const completion = await this.openai.chat.completions.create({
      model: this.responseModel,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `Você é um revisor final de respostas de WhatsApp.
Sua tarefa é deixar a resposta mais humana, natural, curta e conversacional, sem parecer robótica.
Preserve integralmente o sentido original, as regras da base e qualquer necessidade de handoff.
Nunca invente fatos.
Retorne JSON:
{
  "parts": ["parte 1", "parte 2"],
  "shouldHandoff": false,
  "handoffReason": null
}
Regras:
- no máximo 4 partes curtas
- sem markdown
- sem tom robótico
- sem saudação repetida
- preserve shouldHandoff e handoffReason quando fizer sentido`,
        },
        {
          role: 'user',
          content: `Cliente: ${params.contactName}
Perfil do agente:
${params.agentProfile?.system_prompt || params.agentProfile?.descricao || 'Atendimento cordial e objetivo.'}

Base de conhecimento relevante:
${params.knowledgeContext || 'Sem base de conhecimento adicional.'}

Rascunho atual:
${JSON.stringify(params.draftReply)}`,
        },
      ],
    });

    const fallback = params.draftReply;

    try {
      const parsed = JSON.parse(
        completion.choices[0]?.message?.content || JSON.stringify(fallback),
      ) as {
        handoffReason?: string | null;
        parts?: string[];
        shouldHandoff?: boolean;
      };

      const parts = (parsed.parts || [])
        .flatMap((part) => this.normalizeAssistantParts(part))
        .filter(Boolean)
        .slice(0, 4);

      const reviewed = {
        handoffReason:
          parsed.handoffReason !== undefined
            ? parsed.handoffReason || null
            : fallback.handoffReason,
        parts: parts.length ? parts : fallback.parts,
        shouldHandoff:
          parsed.shouldHandoff !== undefined
            ? Boolean(parsed.shouldHandoff)
            : fallback.shouldHandoff,
      };

      this.logAutomationDebug(params.batchId, 'agent4.review.done', {
        finalParts: reviewed.parts.length,
        shouldHandoff: reviewed.shouldHandoff,
      });

      return reviewed;
    } catch {
      this.logAutomationDebug(params.batchId, 'agent4.review.fallback');
      return fallback;
    }
  }

  private async registerHandoff(params: {
    alertAlreadySentAt: string | null;
    assignedUserId: string | null;
    connectionInstanceName: string;
    connectionName: string;
    conversationId: string;
    contactName: string;
    contactPhone: string;
    preferenceEnabled: boolean;
    profileId: string;
    requestedAt: string | null;
    reason: string | null;
    whatsappConnectionId: string;
  }) {
    if (params.requestedAt) {
      return;
    }

    const now = new Date().toISOString();
    await this.supabaseService.getClient().from('conversas').update({
      human_intervention_requested_at: now,
      human_intervention_reason: params.reason,
      updated_at: now,
    }).eq('id', params.conversationId);

    await this.supabaseService.getClient().from('conversas_mensagens').insert({
      conversa_id: params.conversationId,
      profile_id: params.profileId,
      whatsapp_connection_id: params.whatsappConnectionId,
      direction: 'system',
      sender_type: 'system',
      message_type: 'text',
      content: params.reason
        ? `A IA solicitou intervenção humana: ${params.reason}`
        : 'A IA solicitou intervenção humana nesta conversa.',
      status: 'sent',
      created_at: now,
      updated_at: now,
    });

    if (!params.preferenceEnabled || params.assignedUserId || params.alertAlreadySentAt) {
      return;
    }

    const attendantNumbers = await this.getAttendantAlertNumbers(
      params.profileId,
      params.whatsappConnectionId,
    );

    if (!attendantNumbers.length) {
      return;
    }

    const alertMessage = [
      'Atencao: a IA identificou necessidade de intervencao humana.',
      `Conversa: ${params.contactName} (${this.normalizeWhatsapp(params.contactPhone) || params.contactPhone})`,
      `Conexao: ${params.connectionName}`,
      params.reason ? `Motivo: ${params.reason}` : null,
      'Abra a plataforma para assumir o atendimento quando necessario.',
    ]
      .filter(Boolean)
      .join('\n');

    const uniqueNumbers = Array.from(new Set(attendantNumbers));
    await Promise.all(
      uniqueNumbers.map(async (number) => {
        await this.evolutionApiService.sendTextMessage(
          params.connectionInstanceName,
          number,
          alertMessage,
        );
      }),
    );

    await this.supabaseService.getClient().from('conversas').update({
      last_attendant_alert_at: now,
      updated_at: now,
    }).eq('id', params.conversationId);
  }

  private async sendReplyParts(params: {
    batchId: string;
    connectionId: string;
    conversationId: string;
    instanceName: string;
    number: string;
    parts: string[];
    profileId: string;
    sendErrorMessage: string;
  }) {
    const normalizedParts = params.parts
      .flatMap((part) => this.normalizeAssistantParts(part))
      .map((part) => part.trim())
      .filter(Boolean);

    this.logAutomationDebug(params.batchId, 'reply.send.start', {
      parts: normalizedParts.length,
    });

    for (let index = 0; index < normalizedParts.length; index += 1) {
      const trimmedPart = normalizedParts[index];

      await this.evolutionApiService.sendPresence(
        params.instanceName,
        params.number,
        'composing',
        1500,
      );

      if (index > 0) {
        await this.delay(this.getHumanDelay(trimmedPart));
      }

      const sendResult = await this.evolutionApiService.sendTextMessage(
        params.instanceName,
        params.number,
        trimmedPart,
      );

      if (!sendResult) {
        throw new BadRequestException(params.sendErrorMessage);
      }

      await this.storeAssistantMessage({
        content: trimmedPart,
        conversationId: params.conversationId,
        profileId: params.profileId,
        rawPayload: sendResult,
        whatsappConnectionId: params.connectionId,
      });

      this.logAutomationDebug(params.batchId, 'reply.send.part', {
        index: index + 1,
        text: trimmedPart,
      });
    }
  }

  private async storeAssistantMessage(params: {
    content: string;
    conversationId: string;
    profileId: string;
    rawPayload: Record<string, unknown>;
    whatsappConnectionId: string;
  }) {
    const now = new Date().toISOString();
    const payload = params.rawPayload as {
      data?: { key?: { id?: string | null } } | null;
      id?: string | null;
      key?: { id?: string | null } | null;
    };
    const messageId =
      payload.key?.id ||
      payload.data?.key?.id ||
      payload.id ||
      null;

    await this.supabaseService.getClient().from('conversas_mensagens').insert({
      conversa_id: params.conversationId,
      profile_id: params.profileId,
      whatsapp_connection_id: params.whatsappConnectionId,
      direction: 'outbound',
      sender_type: 'assistant',
      message_type: 'text',
      content: params.content,
      raw_payload: params.rawPayload,
      status: 'sent',
      created_at: now,
      updated_at: now,
    });

    await this.supabaseService.getClient().from('conversas').update({
      last_message_preview: params.content,
      last_message_at: now,
      updated_at: now,
    }).eq('id', params.conversationId);
  }

  private async finishBatch(batchId: string, lastError?: string | null) {
    await this.supabaseService.getClient().from('conversas_lotes_recebimento').update({
      status: 'completed',
      last_error: lastError || null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', batchId);
  }

  private async buildAiContextFromIncomingMedia(params: {
    content: string | null;
    mediaBuffer: Buffer | null;
    mediaMimeType: string | null;
    messageType: IncomingMessage['messageType'];
  }) {
    if (!params.mediaBuffer || !params.mediaMimeType) {
      return params.content;
    }

    if (!this.configService.get<string>('OPENAI_API_KEY')) {
      return params.content;
    }

    try {
      if (params.messageType === 'audio') {
        this.logger.debug('[media-ai][audio] Iniciando transcricao para contexto.');
        const audioFile = await toFile(
          params.mediaBuffer,
          `audio.${this.getFileExtension(params.messageType, params.mediaMimeType)}`,
          {
            type: params.mediaMimeType,
          },
        );

        const transcript = await this.openai.audio.transcriptions.create({
          file: audioFile,
          model: 'gpt-4o-mini-transcribe',
        });

        this.logger.debug('[media-ai][audio] Transcricao concluida.');
        return transcript.text || params.content || 'Áudio recebido sem transcrição.';
      }

      if (params.messageType === 'image') {
        this.logger.debug('[media-ai][image] Iniciando analise da imagem para contexto.');
        const base64 = params.mediaBuffer.toString('base64');
        const vision = await this.openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Descreva a imagem objetivamente para contexto de atendimento via WhatsApp. Se houver texto, transcreva-o.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${params.mediaMimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
        });

        this.logger.debug('[media-ai][image] Analise da imagem concluida.');
        return vision.choices[0]?.message?.content || params.content || 'Imagem recebida.';
      }
    } catch (error) {
      await this.logsService.warn({
        action: 'conversas.buildAiContextFromIncomingMedia',
        context: ConversasService.name,
        error,
        message: 'Nao foi possivel enriquecer contexto de midia',
      });
    }

    if (params.messageType === 'video') {
      return params.content || 'Vídeo recebido do cliente.';
    }

    if (params.messageType === 'sticker') {
      this.logger.debug('[media-ai][sticker] Figurinha recebida sem analise semantica.');
      return 'Figurinha enviada pelo cliente.';
    }

    return params.content;
  }

  private buildMessageContextText(
    messageType: string,
    content: string | null,
    aiContextText: string | null,
  ) {
    if (aiContextText?.trim()) {
      return aiContextText.trim();
    }

    if (content?.trim()) {
      return content.trim();
    }

    return this.getFallbackPreview(messageType);
  }

  private normalizeAssistantParts(text: string) {
    const cleaned = text.trim();
    if (!cleaned) {
      return [];
    }

    const parts = cleaned
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.length ? parts : [cleaned];
  }

  private cosineSimilarity(left: number[], right: number[]) {
    if (!left.length || !right.length || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let normLeft = 0;
    let normRight = 0;

    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      normLeft += left[index] ** 2;
      normRight += right[index] ** 2;
    }

    if (!normLeft || !normRight) {
      return 0;
    }

    return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight));
  }

  private getHumanDelay(text: string) {
    const baseDelay = Math.min(4_500, Math.max(1_200, text.length * 32));
    const jitter = Math.floor(Math.random() * 900);
    return baseDelay + jitter;
  }

  private normalizeEvolutionConnectionState(payload: any) {
    const rawState =
      payload?.instance?.state ||
      payload?.state ||
      payload?.status ||
      payload?.instance?.status ||
      payload?.connectionStatus ||
      null;

    const normalized = String(rawState || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '.');

    if (normalized === 'open' || normalized === 'connected') {
      return 'connected';
    }

    if (normalized === 'connecting') {
      return 'connecting';
    }

    return 'disconnected';
  }

  private logAutomationDebug(
    batchId: string,
    step: string,
    metadata?: Record<string, unknown>,
  ) {
    const payload =
      metadata && Object.keys(metadata).length
        ? ` ${JSON.stringify(metadata)}`
        : '';
    this.logger.debug(`[automation][batch:${batchId}][${step}]${payload}`);
  }

  private normalizeLooseText(value: string | null | undefined) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}:]+/gu, ' ')
      .trim();
  }

  private clampPaginationLimit(
    value: number | null | undefined,
    fallback: number,
    max: number,
  ) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(1, Math.floor(value as number)));
  }

  private async delay(timeout: number) {
    await new Promise((resolve) => setTimeout(resolve, timeout));
  }

  private getFileExtension(messageType: string, mimeType: string | null) {
    if (mimeType?.includes('jpeg')) return 'jpg';
    if (mimeType?.includes('png')) return 'png';
    if (mimeType?.includes('webp')) return 'webp';
    if (mimeType?.includes('ogg')) return 'ogg';
    if (mimeType?.includes('mp4')) return 'mp4';

    const fallback: Record<string, string> = {
      audio: 'ogg',
      image: 'jpg',
      sticker: 'webp',
      unsupported: 'bin',
      video: 'mp4',
    };

    return fallback[messageType] || 'bin';
  }

  private normalizeWhatsapp(value: string | null | undefined) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 10 ? digits : null;
  }

  private extractRemoteJid(messageData: any, payload: any) {
    const candidate =
      messageData?.key?.remoteJid ||
      messageData?.key?.participant ||
      payload?.sender?.id ||
      payload?.data?.sender?.id ||
      null;

    return typeof candidate === 'string' ? candidate : null;
  }

  private extractBase64MediaPayload(payload: unknown): string | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      const dataUrlMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
      if (dataUrlMatch?.[1]) {
        return dataUrlMatch[1];
      }

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return this.extractBase64MediaPayload(JSON.parse(trimmed));
        } catch {
          return null;
        }
      }

      return trimmed || null;
    }

    if (typeof payload !== 'object') {
      return null;
    }

    const candidates = [
      (payload as any).base64,
      (payload as any).data?.base64,
      (payload as any).response?.base64,
      (payload as any).data,
      (payload as any).response,
      (payload as any).body,
    ];

    for (const candidate of candidates) {
      const extracted = this.extractBase64MediaPayload(candidate);
      if (extracted) {
        return extracted;
      }
    }

    return null;
  }

  private async refreshConversationContactAvatars<T extends any[]>(conversations: T): Promise<T> {
    const refreshed = await Promise.all(
      conversations.map((conversation) => this.refreshConversationContactAvatar(conversation)),
    );
    return refreshed as T;
  }

  private async refreshConversationContactAvatar<T extends Record<string, any>>(conversation: T) {
    const contact = this.unwrapRelation(conversation?.contatos);
    const whatsappConnection = this.unwrapRelation(conversation?.whatsapp_connections);
    const instanceName = whatsappConnection?.instance_name || null;
    const phone = contact?.whatsapp || null;

    if (!contact?.id || !instanceName || !phone) {
      return conversation;
    }

    const nextAvatarUrl = await this.resolveContactAvatarUrl(
      instanceName,
      phone,
      null,
      contact.avatar_url || null,
    );

    if (!nextAvatarUrl || nextAvatarUrl === contact.avatar_url) {
      return conversation;
    }

    await this.supabaseService
      .getClient()
      .from('contatos')
      .update({
        avatar_url: nextAvatarUrl,
      })
      .eq('id', contact.id);

    const updatedContact = {
      ...contact,
      avatar_url: nextAvatarUrl,
    };

    return {
      ...conversation,
      contatos: Array.isArray(conversation?.contatos) ? [updatedContact] : updatedContact,
    };
  }

  private async resolveContactAvatarUrl(
    instanceName: string,
    phone: string,
    remoteJid: string | null,
    currentAvatarUrl?: string | null,
  ) {
    if (currentAvatarUrl && !this.isWhatsappAvatarUrl(currentAvatarUrl)) {
      return currentAvatarUrl;
    }

    if (currentAvatarUrl && (await this.isReachableAvatarUrl(currentAvatarUrl))) {
      return currentAvatarUrl;
    }

    const remoteIdentifier = this.buildEvolutionContactIdentifier(phone, remoteJid);
    if (!remoteIdentifier) {
      return currentAvatarUrl || null;
    }

    const response = await this.evolutionApiService.fetchProfilePictureUrl(
      instanceName,
      remoteIdentifier,
    );

    return (
      response?.profilePictureUrl ||
      response?.data?.profilePictureUrl ||
      currentAvatarUrl ||
      null
    );
  }

  private buildEvolutionContactIdentifier(phone: string, remoteJid: string | null) {
    if (typeof remoteJid === 'string' && remoteJid.includes('@')) {
      return remoteJid;
    }

    const normalizedPhone = this.normalizeWhatsapp(phone);
    return normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null;
  }

  private isWhatsappAvatarUrl(url: string) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.endsWith('whatsapp.net');
    } catch {
      return false;
    }
  }

  private async isReachableAvatarUrl(url: string) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4_000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private unwrapRelation<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
