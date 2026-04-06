import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

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

  constructor(private readonly configService: ConfigService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const configuredApiKey = this.configService
      .get<string>('EVOLUTION_API_KEY')
      ?.trim();

    if (!configuredApiKey) {
      this.logger.warn(
        'EVOLUTION_API_KEY não configurada. Permitindo requisição sem validação.',
      );
      return true;
    }

    const headerSecret = this.extractSecret(request);
    if (!headerSecret) {
      this.logger.warn('Webhook bloqueado por API key ausente.');
      throw new HttpException('Webhook não autorizado.', HttpStatus.UNAUTHORIZED);
    }

    this.logger.log(
      `Webhook auth debug: instance=${typeof request.body?.instance === 'string' ? request.body.instance : '[sem-instance]'} headerSecretPreview=${this.previewSecret(headerSecret)} headerSources=${this.describeSecretSources(request)}`,
    );

    if (headerSecret === configuredApiKey) {
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
        this.logger.log(
          `Webhook auth debug: aceitando apikey dinâmica da instância para ${instanceName}.`,
        );
        return true;
      }

      const instanceApiKey = await this.fetchInstanceApiKey(
        instanceName,
        configuredApiKey,
      );

      this.logger.log(
        `Webhook auth debug: instance=${instanceName} globalPreview=${this.previewSecret(configuredApiKey)} instancePreview=${this.previewSecret(instanceApiKey)}`,
      );

      if (instanceApiKey && headerSecret === instanceApiKey) {
        return true;
      }

      this.logger.warn(
        `Webhook bloqueado por API key inválida. Global e instância não bateram para ${instanceName}.`,
      );
    } else {
      this.logger.warn('Webhook bloqueado por API key inválida e sem instance no payload.');
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
    const baseUrl = this.configService
      .get<string>('EVOLUTION_API_URL')
      ?.replace(/\/+$/, '');

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

      this.logger.log(
        `Webhook auth debug: fetchInstanceApiKey status=${response.status} url=${url}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Webhook auth debug: fetchInstanceApiKey non-ok body=${errorText}`,
        );
        return null;
      }

      const payload = (await response.json()) as Array<{
        instance?: {
          apikey?: string;
        };
      }>;

      this.logger.log(
        `Webhook auth debug: fetchInstanceApiKey payloadType=${Array.isArray(payload) ? 'array' : typeof payload} payloadSize=${Array.isArray(payload) ? payload.length : 0}`,
      );

      const first = Array.isArray(payload) ? payload[0] : null;
      return first?.instance?.apikey?.trim() || null;
    } catch {
      this.logger.warn('Webhook auth debug: fetchInstanceApiKey threw exception.');
      return null;
    }
  }

  private previewSecret(value: string | null | undefined) {
    if (!value) {
      return '[null]';
    }

    if (value.length <= 8) {
      return value;
    }

    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  private describeSecretSources(request: WebhookRequest) {
    return JSON.stringify({
      authorization: Boolean(request.headers.authorization),
      apiKeyHeader: Boolean(request.headers.apikey),
      tokenHeader: Boolean(request.headers.token),
      secretHeader: Boolean(request.headers['x-webhook-secret']),
      evolutionHeader: Boolean(request.headers['x-evolution-secret']),
      queryApiKey: Boolean(request.query.apikey),
      queryToken: Boolean(request.query.token),
      querySecret: Boolean(request.query.secret),
      bodyApiKey: Boolean(request.body?.apikey),
      bodyToken: Boolean(request.body?.token),
      bodySecret: Boolean(request.body?.secret),
    });
  }
}
