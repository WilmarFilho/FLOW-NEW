import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from './evolution-api.service';
import { CreateWhatsappDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';
import { LogsService } from '../logs/logs.service';
import { ConversasService } from '../conversas/conversas.service';

export type WhatsappConnectionRecord = {
  id?: string;
  nome?: string;
  numero?: string;
  status?: string;
  instance_name?: string;
  agente_id?: string | null;
  conhecimento_id?: string | null;
  business_hours?: unknown;
  appointment_slot_minutes?: number;
  ultima_atualizacao?: string;
  [key: string]: unknown;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly logsService: LogsService,
    @Inject(forwardRef(() => ConversasService))
    private readonly conversasService: ConversasService,
  ) { }

  /**
   * Lista todas as conexões de um usuário
   */
  async listConnections(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .select('*, agentes_ia(id, nome), conhecimentos(id, titulo)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list connections: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Cria uma nova conexão + instância na Evolution API
   * Fluxo: Cria na Evolution → Pega o ID → Insere no Supabase com o MESMO ID
   */
  async createConnection(dto: CreateWhatsappDto) {
    // Gera um nome de instância único
    const instanceName = `flow_${dto.user_id.slice(0, 8)}_${Date.now()}`;

    try {
      // 1. Cria a instância na Evolution API PRIMEIRO
      const evolutionResult = await this.evolutionApi.createInstance(
        instanceName,
        dto.numero || undefined,
      );

      if (!evolutionResult) {
        throw new Error('Falha ao criar instância na Evolution API');
      }

      // 2. Extrai o ID retornado pela Evolution para sincronizar
      const evolutionId =
        evolutionResult?.instance?.instanceId ||
        evolutionResult?.instanceId ||
        evolutionResult?.id ||
        null;

      // 3. Monta o registro para o Supabase, usando o ID da Evolution quando disponível
      const insertData: Record<string, any> = {
        user_id: dto.user_id,
        nome: dto.nome,
        numero: dto.numero || '',
        status: 'connecting',
        instance_name: instanceName,
        agente_id: dto.agente_id || null,
        conhecimento_id: dto.conhecimento_id || null,
        business_hours: dto.business_hours || {
          timezone: 'America/Sao_Paulo',
          days: {},
        },
        appointment_slot_minutes: dto.appointment_slot_minutes || 60,
      };

      // Se a Evolution retornou um ID, usamos ele para manter sincronizado
      if (evolutionId) {
        insertData.id = evolutionId;
      }

      // 4. Insere no Supabase com o mesmo ID
      const { data, error } = await this.supabaseService
        .getClient()
        .from('whatsapp_connections')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Rollback: deleta a instância na Evolution
        await this.evolutionApi.deleteInstance(instanceName);
        throw error;
      }

      // 5. Busca QR code ou pairing code
      let qrCode: string | null = null;
      let pairingCode: string | null = null;

      if (dto.numero) {
        // Conexão via código de pareamento — o resultado de create já traz
        pairingCode = evolutionResult?.pairingCode || evolutionResult?.code || null;
      } else {
        // Conexão via QR Code
        const connectResult = await this.evolutionApi.connectInstance(instanceName);
        qrCode = connectResult?.base64 || connectResult?.qrcode?.base64 || null;
      }

      return {
        connection: data,
        qrCode,
        pairingCode,
      };
    } catch (error) {
      this.logsService.createLog({
        level: 'error',
        action: 'whatsapp.createConnection',
        message: error instanceof Error ? error.message : String(error),
        metadata: { dto, instanceName },
        user_id: dto.user_id,
      });
      throw error;
    }
  }

  /**
   * Edita uma conexão existente (nome, agente, conhecimento)
   */
  async updateConnection(
    id: string,
    userId: string,
    dto: UpdateWhatsappDto,
  ): Promise<WhatsappConnectionRecord> {
    const updateData: Record<string, any> = {
      ultima_atualizacao: new Date().toISOString(),
    };
    if (dto.nome !== undefined) updateData.nome = dto.nome;
    if (dto.agente_id !== undefined) updateData.agente_id = dto.agente_id || null;
    if (dto.conhecimento_id !== undefined) updateData.conhecimento_id = dto.conhecimento_id || null;
    if (dto.business_hours !== undefined) updateData.business_hours = dto.business_hours;
    if (dto.appointment_slot_minutes !== undefined) {
      updateData.appointment_slot_minutes = dto.appointment_slot_minutes;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update connection: ${error.message}`);
      throw error;
    }

    if (!data) {
      throw new NotFoundException('Conexão não encontrada');
    }

    return data as WhatsappConnectionRecord;
  }

  /**
   * Deleta uma conexão e a instância correspondente na Evolution API
   */
  async deleteConnection(id: string, userId: string) {
    // Busca a conexão para pegar o instance_name
    const { data: connection, error: fetchError } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .select('instance_name')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !connection) {
      throw new NotFoundException('Conexão não encontrada');
    }

    // Deleta na Evolution API
    if (connection.instance_name) {
      await this.evolutionApi.logoutInstance(connection.instance_name);
      await this.evolutionApi.deleteInstance(connection.instance_name);
    }

    // Deleta no Supabase
    const { error } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to delete connection: ${error.message}`);
      throw error;
    }

    return { deleted: true };
  }

  /**
   * Envia uma mensagem de teste via WhatsApp
   */
  async sendTestMessage(id: string, userId: string, number: string, message: string) {
    const { data: connection, error } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .select('instance_name, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      throw new NotFoundException('Conexão não encontrada');
    }

    if (connection.status !== 'connected') {
      throw new Error('WhatsApp não está conectado. Conecte antes de testar.');
    }

    const result = await this.evolutionApi.sendTextMessage(
      connection.instance_name,
      number,
      message,
    );

    return { success: !!result, result };
  }

  /**
   * Processa webhook da Evolution API (connection status update)
   */
  async handleWebhook(payload: any) {
    const event = payload.event;
    const instanceName = payload.instance;

    this.logger.log(`Webhook received: ${event} for instance ${instanceName}`);

    if (!instanceName) return { processed: false };
    const normalizedEvent = String(event || '').toLowerCase();

    if (normalizedEvent.includes('messages.upsert')) {
      return this.conversasService.handleWhatsappWebhook(payload);
    }

    // Mapeia eventos da Evolution para nossos status
    let newStatus: string | null = null;
    let phoneNumber: string | null = null;

    if (event === 'connection.update') {
      const state = payload.data?.state || payload.data?.status;
      if (state === 'open' || state === 'connected') {
        newStatus = 'connected';

        // Extrai o número do WhatsApp da resposta da Evolution v2.3
        // O número pode vir em vários campos dependendo do evento
        const wid = payload.data?.wid || payload.data?.ownerJid;
        if (wid) {
          // wid vem no formato "5511999999999@s.whatsapp.net"
          phoneNumber = wid.split('@')[0] || null;
        }
        if (!phoneNumber && payload.data?.number) {
          phoneNumber = payload.data.number;
        }
      } else if (state === 'close' || state === 'disconnected') {
        newStatus = 'disconnected';
      } else if (state === 'connecting') {
        newStatus = 'connecting';
      }
    }

    if (event === 'qrcode.updated') {
      newStatus = 'connecting';
    }

    if (!newStatus) return { processed: false, event };

    // Monta update dinâmico
    const updateData: Record<string, any> = {
      status: newStatus,
      ultima_atualizacao: new Date().toISOString(),
    };

    // Se extraiu o número, atualiza também
    if (phoneNumber) {
      updateData.numero = phoneNumber;
      this.logger.log(`Phone number extracted: ${phoneNumber}`);
    }

    // Atualiza no Supabase → Realtime vai propagar pro frontend
    const { error } = await this.supabaseService
      .getClient()
      .from('whatsapp_connections')
      .update(updateData)
      .eq('instance_name', instanceName);

    console.log(updateData);

    if (error) {
      this.logger.error(`Webhook update failed: ${error.message}`);
      return { processed: false, error: error.message };
    }

    this.logger.log(`Connection ${instanceName} status updated to ${newStatus}`);
    return { processed: true, status: newStatus, numero: phoneNumber };
  }
}
