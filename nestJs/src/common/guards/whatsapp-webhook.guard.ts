import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { LogsService } from '../../logs/logs.service';
import { EvolutionApiService } from '../../whatsapp/evolution-api.service';
import { ConfigService } from '@nestjs/config';

type WebhookRequest = Request & {
  body?: {
    apikey?: string;
    secret?: string;
    token?: string;
  };
  headers: Request['headers'] & {
    apikey?: string | string[];
    token?: string | string[];
    'x-webhook-secret'?: string | string[];
    'x-evolution-secret'?: string | string[];
    authorization?: string | string[];
  };
  query: Request['query'] & {
    apikey?: string | string[];
    secret?: string | string[];
    token?: string | string[];
  };
};

@Injectable()
export class WhatsappWebhookGuard implements CanActivate {
  private readonly logger = new Logger(WhatsappWebhookGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
    private readonly evolutionApiService: EvolutionApiService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const configuredApiKey = this.configService
      .get<string>('EVOLUTION_API_KEY')
      ?.trim();
    const configuredWebhookSecret =
      this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET')?.trim() ||
      this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET')?.trim();

    if (!configuredApiKey && !configuredWebhookSecret) {
      await this.logsService.warn({
        action: 'whatsapp.webhook.auth',
        context: WhatsappWebhookGuard.name,
        message:
          'Nenhuma API Key ou Webhook Secret configurados. Permitindo requisição sem validação.',
      });
      return true;
    }

    const headerSecret = this.extractSecret(request);
    if (!headerSecret) {
      await this.logsService.warn({
        action: 'whatsapp.webhook.auth',
        context: WhatsappWebhookGuard.name,
        message: 'Webhook bloqueado por API key ausente.',
        metadata: {
          instance: typeof request.body?.instance === 'string' ? request.body.instance : null,
        },
      });
      throw new HttpException('Webhook não autorizado.', HttpStatus.UNAUTHORIZED);
    }


    if (configuredApiKey && headerSecret === configuredApiKey) {
      return true;
    }

    if (configuredWebhookSecret && headerSecret === configuredWebhookSecret) {
      return true;
    }

    const instanceName =
      typeof request.body?.instance === 'string' ? request.body.instance : null;

    if (instanceName) {
      const bodyApiKey =
        typeof request.body?.apikey === 'string'
          ? request.body.apikey.trim()
          : null;

      if (bodyApiKey && headerSecret === bodyApiKey) {
        return true;
      }

      const instanceApiKey = configuredApiKey
        ? await this.fetchInstanceApiKey(instanceName, configuredApiKey)
        : null;


      if (instanceApiKey && headerSecret === instanceApiKey) {
        return true;
      }

      await this.logsService.warn({
        action: 'whatsapp.webhook.auth',
        context: WhatsappWebhookGuard.name,
        message: `Webhook bloqueado por API key inválida. Global e instância não bateram para ${instanceName}.`,
        metadata: { instanceName },
      });
    } else {
      await this.logsService.warn({
        action: 'whatsapp.webhook.auth',
        context: WhatsappWebhookGuard.name,
        message:
          'Webhook bloqueado por API key inválida e sem instance no payload.',
      });
    }

    throw new HttpException('Webhook não autorizado.', HttpStatus.UNAUTHORIZED);
  }

  private extractSecret(request: WebhookRequest) {
    const requestBody = request.body as
      | {
        secret?: string;
        token?: string;
        apikey?: string;
      }
      | undefined;
    const apiKeyHeader = request.headers.apikey;
    const tokenHeader = request.headers.token;
    const secretHeader = request.headers['x-webhook-secret'];
    const evolutionHeader = request.headers['x-evolution-secret'];
    const authorization = request.headers.authorization;
    const querySecret = request.query.secret;
    const queryToken = request.query.token;
    const queryApiKey = request.query.apikey;

    const normalizedAuthorization = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (typeof normalizedAuthorization === 'string') {
      const match = normalizedAuthorization.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    if (Array.isArray(secretHeader)) {
      return secretHeader[0];
    }

    if (typeof secretHeader === 'string') {
      return secretHeader;
    }

    if (Array.isArray(evolutionHeader)) {
      return evolutionHeader[0];
    }

    if (typeof evolutionHeader === 'string') {
      return evolutionHeader;
    }

    if (Array.isArray(apiKeyHeader)) {
      return apiKeyHeader[0];
    }

    if (typeof apiKeyHeader === 'string') {
      return apiKeyHeader;
    }

    if (Array.isArray(tokenHeader)) {
      return tokenHeader[0];
    }

    if (typeof tokenHeader === 'string') {
      return tokenHeader;
    }

    if (Array.isArray(querySecret)) {
      return querySecret[0];
    }

    if (typeof querySecret === 'string') {
      return querySecret;
    }

    if (Array.isArray(queryToken)) {
      return queryToken[0];
    }

    if (typeof queryToken === 'string') {
      return queryToken;
    }

    if (Array.isArray(queryApiKey)) {
      return queryApiKey[0];
    }

    if (typeof queryApiKey === 'string') {
      return queryApiKey;
    }

    if (typeof requestBody?.secret === 'string') {
      return requestBody.secret;
    }

    if (typeof requestBody?.token === 'string') {
      return requestBody.token;
    }

    return typeof requestBody?.apikey === 'string' ? requestBody.apikey : null;
  }

  private async fetchInstanceApiKey(
    instanceName: string,
    configuredApiKey: string,
  ) {
    const baseUrl = await this.evolutionApiService.getBaseUrlForInstance(
      instanceName,
    );

    if (!baseUrl) {
      return null;
    }

    try {
      const url = `${baseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: configuredApiKey,
        },
      });


      if (!response.ok) {
        const errorText = await response.text();
        await this.logsService.warn({
          action: 'whatsapp.webhook.fetchInstanceApiKey',
          context: WhatsappWebhookGuard.name,
          message: 'Webhook auth debug: fetchInstanceApiKey retornou resposta não-ok.',
          metadata: { errorText, instanceName, status: response.status },
        });
        return null;
      }

      const payload = (await response.json()) as Array<{
        instance?: {
          apikey?: string;
        };
      }>;


      const first = Array.isArray(payload) ? payload[0] : null;
      return first?.instance?.apikey?.trim() || null;
    } catch (error) {
      await this.logsService.warn({
        action: 'whatsapp.webhook.fetchInstanceApiKey',
        context: WhatsappWebhookGuard.name,
        error,
        message: 'Webhook auth debug: fetchInstanceApiKey threw exception.',
        metadata: { instanceName },
      });
      return null;
    }
  }
}
