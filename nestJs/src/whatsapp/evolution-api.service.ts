import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
    this.webhookBaseUrl = (this.configService.get<string>('WEBHOOK_BASE_URL') || '').replace(/\/+$/, '');

    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn('Evolution API URL ou API Key não configuradas no .env');
    }
    if (!this.webhookBaseUrl) {
      this.logger.warn('WEBHOOK_BASE_URL não configurada no .env');
    }
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T | null> {
    try {
      const url = `${this.baseUrl}${path}`;
      this.logger.log(`Evolution API ${method} ${url}`);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Evolution API error ${response.status}: ${errorText}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error('Evolution API request failed', error);
      return null;
    }
  }

  /**
   * Cria uma nova instância na Evolution API (v2.3.7)
   * Inclui configuração de webhook para receber CONNECTION_UPDATE
   */
  async createInstance(instanceName: string, number?: string): Promise<any> {
    const body: any = {
      instanceName,
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
      },
    };

    if (number) {
      body.number = number;
    }

    return this.request('POST', '/instance/create', body);
  }

  /**
   * Busca o QR Code para conexão
   */
  async connectInstance(instanceName: string): Promise<any> {
    return this.request('GET', `/instance/connect/${instanceName}`);
  }

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceName: string): Promise<any> {
    return this.request('DELETE', `/instance/delete/${instanceName}`);
  }

  /**
   * Busca o status de uma instância
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    return this.request('GET', `/instance/connectionState/${instanceName}`);
  }

  /**
   * Desconecta (logout) uma instância
   */
  async logoutInstance(instanceName: string): Promise<any> {
    return this.request('DELETE', `/instance/logout/${instanceName}`);
  }

  /**
   * Envia uma mensagem de texto
   */
  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number,
      text,
    });
  }
}
