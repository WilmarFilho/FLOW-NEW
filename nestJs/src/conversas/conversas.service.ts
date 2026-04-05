/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';
import { CreateConversaDto } from './dto/create-conversa.dto';

type AccessContext = {
  allowedConnectionIds: string[] | null;
  effectiveAdminId: string;
  isAtendente: boolean;
  userId: string;
};

type IncomingMessage = {
  content: string | null;
  externalMessageId: string | null;
  mediaBuffer: Buffer | null;
  mediaMimeType: string | null;
  messageType: 'text' | 'audio' | 'image' | 'video' | 'sticker' | 'unsupported';
  phone: string;
  pushName: string | null;
  rawPayload: Record<string, unknown>;
};

@Injectable()
export class ConversasService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => EvolutionApiService))
    private readonly evolutionApiService: EvolutionApiService,
    private readonly logsService: LogsService,
  ) {}

  async listConversas(userId: string) {
    const access = await this.getAccessContext(userId);
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
        whatsapp_connections (
          id,
          nome,
          numero,
          status
        ),
        profile:assigned_user_id (
          auth_id,
          nome_completo,
          foto_perfil
        )
      `,
      )
      .eq('profile_id', access.effectiveAdminId)
      .order('last_message_at', { ascending: false });

    this.applyConnectionScope(query, access.allowedConnectionIds);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getConversa(userId: string, conversaId: string) {
    return this.getAccessibleConversa(userId, conversaId);
  }

  async listMensagens(userId: string, conversaId: string) {
    const conversa = await this.getAccessibleConversa(userId, conversaId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .select('*')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async createConversa(userId: string, dto: CreateConversaDto) {
    const access = await this.getAccessContext(userId);
    await this.assertContatoAccess(access, dto.contato_id);
    await this.assertConnectionAccess(access, dto.whatsapp_connection_id);

    const client = this.supabaseService.getClient();

    const { data: existing } = await client
      .from('conversas')
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
        whatsapp_connections ( id, nome, numero, status ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .eq('profile_id', access.effectiveAdminId)
      .eq('contato_id', dto.contato_id)
      .eq('whatsapp_connection_id', dto.whatsapp_connection_id)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from('conversas')
      .insert({
        profile_id: access.effectiveAdminId,
        contato_id: dto.contato_id,
        whatsapp_connection_id: dto.whatsapp_connection_id,
        last_message_at: now,
        updated_at: now,
      })
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
        whatsapp_connections ( id, nome, numero, status ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .single();

    if (error || !data) {
      throw error;
    }

    return data;
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
        whatsapp_connections ( id, nome, numero, status ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .single();

    if (error || !data) {
      throw error;
    }

    return data;
  }

  async sendMensagem(userId: string, conversaId: string, content: string) {
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Informe a mensagem antes de enviar.');
    }

    const conversa = await this.getAccessibleConversa(userId, conversaId);

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

    const result = await this.evolutionApiService.sendTextMessage(
      connection.instance_name,
      normalizedNumber,
      trimmedContent,
    );

    if (!result) {
      throw new BadRequestException('Falha ao enviar a mensagem pelo WhatsApp.');
    }

    const messageId =
      result?.key?.id || result?.data?.key?.id || result?.id || null;
    const now = new Date().toISOString();

    const { error: messageError } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .insert({
        conversa_id: conversaId,
        profile_id: claimedConversa.profile_id,
        whatsapp_connection_id: claimedConversa.whatsapp_connection_id,
        external_message_id: messageId,
        direction: 'outbound',
        sender_type: 'user',
        sender_user_id: userId,
        message_type: 'text',
        content: trimmedContent,
        raw_payload: result,
        status: 'sent',
        created_at: now,
        updated_at: now,
      });

    if (messageError) {
      throw messageError;
    }

    await this.supabaseService
      .getClient()
      .from('conversas')
      .update({
        assigned_user_id: userId,
        assigned_at: claimedConversa.assigned_at ?? now,
        last_message_preview: trimmedContent,
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', conversaId);

    return { success: true };
  }

  async handleWhatsappWebhook(payload: any) {
    const event = String(payload?.event || '').toLowerCase();

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

    const incomingMessage = await this.extractIncomingMessage(connection, payload);
    if (!incomingMessage) {
      return { processed: false };
    }

    const contact = await this.findOrCreateContact(
      connection.user_id,
      incomingMessage.phone,
      incomingMessage.pushName,
    );

    const conversa = await this.findOrCreateConversa(
      connection.user_id,
      connection.id,
      contact.id,
    );

    await this.persistIncomingMessage(conversa, connection.id, incomingMessage);

    return { processed: true, conversaId: conversa.id };
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
          message.externalMessageId,
          message.messageType,
          message.mediaMimeType,
          message.mediaBuffer,
        )
      : null;

    const preview = message.content || this.getFallbackPreview(message.messageType);

    const { error: messageError } = await this.supabaseService
      .getClient()
      .from('conversas_mensagens')
      .upsert(
        {
          conversa_id: conversa.id,
          profile_id: conversa.profile_id,
          whatsapp_connection_id: connectionId,
          external_message_id: message.externalMessageId,
          direction: 'inbound',
          sender_type: 'customer',
          message_type: message.messageType,
          content: message.content,
          media_url: mediaUpload?.publicUrl ?? null,
          media_path: mediaUpload?.path ?? null,
          media_mime_type: message.mediaMimeType,
          raw_payload: message.rawPayload,
          status: 'received',
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'external_message_id' },
      );

    if (messageError) {
      throw messageError;
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

    await this.queueInboundBatch(conversa.id, conversa.profile_id);
  }

  private async queueInboundBatch(conversaId: string, profileId: string) {
    const client = this.supabaseService.getClient();
    const { data: existing } = await client
      .from('conversas_lotes_recebimento')
      .select('id')
      .eq('conversa_id', conversaId)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existing) {
      return;
    }

    await client.from('conversas_lotes_recebimento').insert({
      conversa_id: conversaId,
      profile_id: profileId,
      scheduled_for: new Date(Date.now() + 35_000).toISOString(),
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
        updated_at: now,
      })
      .eq('id', conversa.id)
      .or(`assigned_user_id.is.null,assigned_user_id.eq.${userId}`)
      .select(
        `
        *,
        contatos ( id, nome, whatsapp, avatar_url ),
        whatsapp_connections ( id, nome, numero, status, instance_name ),
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
        whatsapp_connections ( id, nome, numero, status, instance_name ),
        profile:assigned_user_id ( auth_id, nome_completo, foto_perfil )
      `,
      )
      .eq('id', conversaId)
      .eq('profile_id', access.effectiveAdminId);

    this.applyConnectionScope(query, access.allowedConnectionIds);

    const { data, error } = await query.single();

    if (error || !data) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    return data;
  }

  private async assertContatoAccess(access: AccessContext, contatoId: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('contatos')
      .select('id')
      .eq('id', contatoId)
      .eq('profile_id', access.effectiveAdminId)
      .maybeSingle();

    if (!data) {
      throw new NotFoundException('Contato não encontrado.');
    }
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
      .eq('user_id', access.effectiveAdminId);

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

  private async findConnectionByInstance(instanceName: string) {
    const { data } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .select('id, user_id, instance_name, nome')
      .eq('instance_name', instanceName)
      .maybeSingle();

    return data;
  }

  private async extractIncomingMessage(connection: any, payload: any) {
    const messageData = payload?.data || payload?.body?.data || null;
    if (!messageData?.key || messageData.key.fromMe) {
      return null;
    }

    const phone = this.normalizeWhatsapp(messageData.key.remoteJid || '');
    if (!phone) {
      return null;
    }

    const messageType = this.detectMessageType(messageData.message);
    let content = this.extractTextContent(messageData.message, messageType);
    let mediaBuffer: Buffer | null = null;
    let mediaMimeType: string | null = this.extractMimeType(
      messageData.message,
      messageType,
    );

    if (messageType !== 'text' && messageType !== 'unsupported') {
      const base64Payload =
        await this.evolutionApiService.getBase64FromMediaMessage(
          connection.id,
          messageData,
        );

      const base64 =
        base64Payload?.base64 ||
        base64Payload?.data?.base64 ||
        base64Payload?.response?.base64 ||
        null;

      if (typeof base64 === 'string') {
        mediaBuffer = Buffer.from(base64, 'base64');
      }
    }

    if (!content && messageType === 'unsupported') {
      content = 'Mensagem não suportada';
    }

    return {
      content,
      externalMessageId: messageData.key.id || null,
      mediaBuffer,
      mediaMimeType,
      messageType,
      phone,
      pushName: payload?.data?.pushName || payload?.pushName || null,
      rawPayload: payload,
    } satisfies IncomingMessage;
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
  ) {
    const client = this.supabaseService.getClient();
    const { data: existing } = await client
      .from('contatos')
      .select('id, nome, whatsapp, avatar_url')
      .eq('profile_id', profileId)
      .eq('whatsapp', phone)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data, error } = await client
      .from('contatos')
      .insert({
        profile_id: profileId,
        nome: pushName || phone,
        whatsapp: phone,
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
      .maybeSingle();

    if (existing) {
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

    return data;
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

  private unwrapRelation<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
