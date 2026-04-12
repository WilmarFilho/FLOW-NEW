import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';

type AuthenticatedRequest = Request & {
  userId?: string;
  headers: Request['headers'] & {
    'x-user-id'?: string | string[];
    authorization?: string | string[];
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new HttpException(
        'Usuário não autenticado',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.supabaseService.verifyAccessToken(token);

    if (!user) {
      throw new HttpException('Token inválido', HttpStatus.UNAUTHORIZED);
    }

    const userId = user.id;

    const supabase = this.supabaseService.getClient();
    const { data: profile, error } = await supabase
      .from('profile')
      .select('tipo_de_usuario')
      .eq('auth_id', userId)
      .single();

    if (error || !profile) {
      throw new HttpException('Perfil não encontrado', HttpStatus.UNAUTHORIZED);
    }

    if (profile.tipo_de_usuario === 'atendente') {
      throw new HttpException(
        'Requisito de acesso não autorizado para atendentes.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('limite_mensagens_mensais, mensagens_enviadas, contatos_usados_campanhas, limite_contatos_campanhas')
        .eq('profile_id', userId)
        .single();
        
      if (subscription) {
        if (
          (subscription.mensagens_enviadas || 0) >= (subscription.limite_mensagens_mensais || 500) ||
          (subscription.contatos_usados_campanhas || 0) >= (subscription.limite_contatos_campanhas || 100)
        ) {
          throw new HttpException('Acesso restrito: Limites do plano foram esgotados. Realize o upgrade.', HttpStatus.FORBIDDEN);
        }
      }
    }

    request.userId = userId;
    return true;
  }

  private extractBearerToken(authorization?: string | string[]) {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!header) {
      return null;
    }

    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
  }
}
