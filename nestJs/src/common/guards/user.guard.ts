import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class UserGuard implements CanActivate {
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
      .select('auth_id')
      .eq('auth_id', userId)
      .single();

    if (error || !profile) {
      throw new HttpException('Perfil não encontrado', HttpStatus.UNAUTHORIZED);
    }

    return true;
  }
}
