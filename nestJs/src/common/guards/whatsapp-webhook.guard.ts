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

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const configuredApiKey = this.configService.get<string>('EVOLUTION_API_KEY');

    if (!configuredApiKey?.trim()) {
      this.logger.warn(
        'EVOLUTION_API_KEY não configurada. Permitindo requisição sem validação.',
      );
      return true;
    }

    const headerSecret = this.extractSecret(request);

    if (!headerSecret || headerSecret !== configuredApiKey) {
      this.logger.warn(
        `Webhook bloqueado por API key inválida ou ausente. Recebido: ${headerSecret ? '[presente]' : '[ausente]'}.`,
      );
      throw new HttpException(
        'Webhook não autorizado.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }

  private extractSecret(request: WebhookRequest) {
    const requestBody = request.body as
      | {
        apikey?: string;
        secret?: string;
        token?: string;
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

    if (typeof requestBody?.secret === 'string') {
      return requestBody.secret;
    }

    if (typeof requestBody?.token === 'string') {
      return requestBody.token;
    }

    if (typeof requestBody?.apikey === 'string') {
      return requestBody.apikey;
    }

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

    return typeof queryApiKey === 'string' ? queryApiKey : null;
  }
}
