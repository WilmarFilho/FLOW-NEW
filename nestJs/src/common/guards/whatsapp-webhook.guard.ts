import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type WebhookRequest = Request & {
  headers: Request['headers'] & {
    'x-webhook-secret'?: string | string[];
    'x-evolution-secret'?: string | string[];
    authorization?: string | string[];
  };
};

@Injectable()
export class WhatsappWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const configuredSecret =
      this.configService.get<string>('WHATSAPP_WEBHOOK_SECRET') ||
      this.configService.get<string>('EVOLUTION_WEBHOOK_SECRET');

    if (!configuredSecret) {
      throw new HttpException(
        'Webhook secret não configurado.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const headerSecret = this.extractSecret(request);

    if (headerSecret !== configuredSecret) {
      throw new HttpException('Webhook não autorizado.', HttpStatus.UNAUTHORIZED);
    }

    return true;
  }

  private extractSecret(request: WebhookRequest) {
    const secretHeader = request.headers['x-webhook-secret'];
    const evolutionHeader = request.headers['x-evolution-secret'];
    const authorization = request.headers.authorization;

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

    return typeof evolutionHeader === 'string' ? evolutionHeader : null;
  }
}
