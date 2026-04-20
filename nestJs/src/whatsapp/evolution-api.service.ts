import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogsService } from '../logs/logs.service';
import { EvolutionRoutingService } from './evolution-routing.service';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly apiKey: string;
  private readonly webhookBaseUrl: string;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private readonly logsService: LogsService,
    private readonly evolutionRoutingService: EvolutionRoutingService,
  ) {
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
    this.webhookBaseUrl = (this.configService.get<string>('WEBHOOK_BASE_URL') || '').replace(/\/+$/, '');
    this.webhookSecret =
      this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET') ||
      this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET') ||
      '';

    if (!this.apiKey) {
      this.logger.warn('Evolution API URL ou API Key não configuradas no .env');
      void this.logsService.warn({
        action: 'whatsapp.evolution.config',
        context: EvolutionApiService.name,
        message: 'Evolution API URL ou API Key não configuradas no .env',
      });
    }
    if (!this.webhookBaseUrl) {
      this.logger.warn('WEBHOOK_BASE_URL não configurada no .env');
      void this.logsService.warn({
        action: 'whatsapp.evolution.config',
        context: EvolutionApiService.name,
        message: 'WEBHOOK_BASE_URL não configurada no .env',
      });
    }
  }

  async getBaseUrlForInstance(instanceName: string) {
    return this.evolutionRoutingService.getBaseUrlForInstance(instanceName);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    routeOptions?: {
      baseUrl?: string | null;
      instanceName?: string;
    },
  ): Promise<T | null> {
    try {
      const resolvedBaseUrl =
        routeOptions?.baseUrl ||
        (routeOptions?.instanceName
          ? await this.evolutionRoutingService.getBaseUrlForInstance(routeOptions.instanceName)
          : null);

      if (!resolvedBaseUrl) {
        throw new Error(
          `Nenhum node Evolution resolvido${routeOptions?.instanceName ? ` para ${routeOptions.instanceName}` : ''}.`,
        );
      }

      const url = `${resolvedBaseUrl}${path}`;

      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        signal: AbortSignal.timeout(25000), // Tempo maior (25s) para criação de instâncias com db persistido
      };

      if (body) {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Evolution API error ${response.status}: ${errorText}`);
        await this.logsService.error({
          action: `whatsapp.evolution.${method.toLowerCase()}`,
          context: EvolutionApiService.name,
          message: `Evolution API error ${response.status}: ${errorText}`,
          metadata: {
            baseUrl: resolvedBaseUrl,
            path,
            status: response.status,
          },
        });
        return null;
      }

      const rawText = await response.text();
      if (!rawText) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      const looksLikeJson =
        contentType.includes('application/json') ||
        rawText.trim().startsWith('{') ||
        rawText.trim().startsWith('[');

      if (looksLikeJson) {
        return JSON.parse(rawText) as T;
      }

      return rawText as T;
    } catch (error) {
      this.logger.error('Evolution API request failed', error);
      await this.logsService.error({
        action: `whatsapp.evolution.${method.toLowerCase()}`,
        context: EvolutionApiService.name,
        error,
        message: 'Evolution API request failed',
        metadata: {
          baseUrl: routeOptions?.baseUrl || null,
          instanceName: routeOptions?.instanceName || null,
          path,
        },
      });
      return null;
    }
  }

  /**
   * Cria uma nova instância na Evolution API (v2.3.7)
   * Inclui configuração de webhook para receber CONNECTION_UPDATE
   */
  async createInstance(instanceName: string, number?: string): Promise<any> {
    const assignedNode = await this.evolutionRoutingService.registerInstance(instanceName);
    const body: any = {
      instanceName,
      groupsIgnore: true,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: !number,
      webhook: {
        enabled: true,
        url: `${this.webhookBaseUrl}/whatsapp/webhook`,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
        ],
        headers: this.webhookSecret
          ? {
            'x-webhook-secret': this.webhookSecret,
            Authorization: `Bearer ${this.webhookSecret}`,
          }
          : undefined,
      },
    };

    if (number) {
      body.number = number;
    }

    const result = await this.request('POST', '/instance/create', body, {
      baseUrl: assignedNode?.url || null,
      instanceName,
    });

    if (!result) {
      await this.evolutionRoutingService.unregisterInstance(instanceName);
    }

    return result;
  }

  /**
   * Busca o QR Code para conexão
   * Resposta da Evolution v2: { code: "base64...", pairingCode: "...", count: 1 }
   */
  async connectInstance(instanceName: string): Promise<any> {
    return this.request('GET', `/instance/connect/${instanceName}`, undefined, {
      instanceName,
    });
  }

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceName: string): Promise<any> {
    const result = await this.request(
      'DELETE',
      `/instance/delete/${instanceName}`,
      undefined,
      { instanceName },
    );

    if (result) {
      await this.evolutionRoutingService.unregisterInstance(instanceName);
    }

    return result;
  }

  /**
   * Busca o status de uma instância
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    return this.request('GET', `/instance/connectionState/${instanceName}`, undefined, {
      instanceName,
    });
  }

  /**
   * Desconecta (logout) uma instância
   */
  async logoutInstance(instanceName: string): Promise<any> {
    return this.request('DELETE', `/instance/logout/${instanceName}`, undefined, {
      instanceName,
    });
  }

  /**
   * Extrai QR code e pairing code da resposta do /instance/connect.
   * Evolution v2: { code: "2@...", pairingCode: "WZYEH1YY", count: 1 }
   * O campo `code` é a string bruta do QR (não é base64 de imagem, é o conteúdo para renderizar).
   * Para exibir como <img>, precisa prefixar com data URI apenas se vier como base64 de imagem.
   */
  extractQrAndPairing(result: any): { qrCode: string | null; pairingCode: string | null } {
    // Evolution v2: `code` é o QR bruto (string tipo "2@xxxxxx...")
    // Evolution v1 (legado): `base64` ou `qrcode.base64` eram imagens base64
    const rawCode: string | null =
      result?.base64 ||
      result?.qrcode?.base64 ||
      null;

    const rawQrString: string | null = result?.code || null;

    let qrCode: string | null = null;
    if (rawCode) {
      // Era base64 de imagem — prefixar com data URI
      qrCode = rawCode.startsWith('data:') ? rawCode : `data:image/png;base64,${rawCode}`;
    } else if (rawQrString) {
      // Evolution v2 retorna o conteúdo cru do QR como string — o frontend deve renderizá-lo
      // mas como usamos <img src=>, precisamos do base64 da imagem.
      // Nesse caso, sinalizamos com null e o frontend mostrará "aguardando via webhook"
      qrCode = null;
    }

    const pairingCode: string | null =
      result?.pairingCode ||
      result?.code_pairing ||
      null;

    return { qrCode, pairingCode };
  }

  /**
   * Envia uma mensagem de texto
   */
  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    return this.request(
      'POST',
      `/message/sendText/${instanceName}`,
      {
        number,
        text,
      },
      { instanceName },
    );
  }

  async sendTextMessageWithOptions(
    instanceName: string,
    payload: {
      number: string;
      text: string;
      quoted?: {
        key: { id: string };
        message: { conversation: string };
      };
    },
  ): Promise<any> {
    return this.request('POST', `/message/sendText/${instanceName}`, payload, {
      instanceName,
    });
  }

  async sendMediaMessage(
    instanceName: string,
    payload: {
      number: string;
      media: string;
      mediatype: string;
      mimetype: string;
      fileName: string;
      caption?: string;
      quoted?: {
        key: { id: string };
        message: { conversation: string };
      };
    },
  ): Promise<any> {
    return this.request('POST', `/message/sendMedia/${instanceName}`, payload, {
      instanceName,
    });
  }

  async sendWhatsAppAudio(
    instanceName: string,
    payload: {
      number: string;
      audio: string;
      quoted?: {
        key: { id: string };
        message: { conversation: string };
      };
    },
  ): Promise<any> {
    return this.request(
      'POST',
      `/message/sendWhatsAppAudio/${instanceName}`,
      payload,
      { instanceName },
    );
  }

  async deleteMessageForEveryone(
    instanceName: string,
    payload: {
      fromMe: boolean;
      id: string;
      participant?: string;
      remoteJid: string;
    },
  ): Promise<any> {
    return this.request(
      'DELETE',
      `/chat/deleteMessageForEveryone/${instanceName}`,
      payload,
      { instanceName },
    );
  }

  async sendPresence(
    instanceName: string,
    number: string,
    presence: 'composing' | 'paused' | 'recording',
    delay = 1500,
  ): Promise<any> {
    return this.request(
      'POST',
      `/chat/sendPresence/${instanceName}`,
      {
        number,
        delay,
        presence,
      },
      { instanceName },
    );
  }

  async getBase64FromMediaMessage(
    instanceName: string,
    messagePayload: Record<string, unknown>,
    convertToMp4 = false,
  ): Promise<any> {
    return this.request(
      'POST',
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        message: messagePayload,
        convertToMp4,
      },
      { instanceName },
    );
  }

  async fetchProfilePictureUrl(instanceName: string, number: string): Promise<any> {
    return this.request(
      'POST',
      `/chat/fetchProfilePictureUrl/${instanceName}`,
      {
        number,
      },
      { instanceName },
    );
  }
}
