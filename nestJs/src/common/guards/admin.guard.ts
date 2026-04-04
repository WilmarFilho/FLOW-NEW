import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

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
      throw new HttpException('Requisito de acesso não autorizado para atendentes.', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
