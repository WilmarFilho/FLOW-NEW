import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AgentesIaService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    const supabase = this.supabaseService.getClient();

    const { data: agentes, error } = await supabase
      .from('agentes_ia')
      .select('id, nome, descricao, icone, system_prompt, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return agentes;
  }
}
