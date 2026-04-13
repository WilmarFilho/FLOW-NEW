import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ResetUsageService {
  private readonly logger = new Logger(ResetUsageService.name);

  constructor(private supabaseService: SupabaseService) { }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {

    try {
      const supers = this.supabaseService.getClient();

      const hoje = new Date().toISOString();

      // Buscar todos os usuários cuja data de renovação passou
      const { data: expirados, error } = await supers
        .from('subscriptions')
        .select('id, plano')
        .lte('data_proxima_renovacao', hoje);

      if (error) {
        throw error;
      }

      if (expirados && expirados.length > 0) {
        // Renova por mais um mês para quem for freemium
        for (const sub of expirados) {
          if (sub.plano === 'freemium') {
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);

            await supers
              .from('subscriptions')
              .update({
                mensagens_enviadas: 0,
                contatos_usados_campanhas: 0,
                data_proxima_renovacao: nextDate.toISOString()
              })
              .eq('id', sub.id);

          }
        }
      }
    } catch (e) {
      this.logger.error(`Falha no cron de reset: ${e.message}`);
    }
  }
}
