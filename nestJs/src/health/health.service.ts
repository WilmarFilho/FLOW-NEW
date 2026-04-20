import * as os from 'os';
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private readonly instanceId = process.env.HOSTNAME ?? os.hostname();
  private readonly serviceName = process.env.SERVICE_NAME ?? 'backend';

  constructor(private readonly supabaseService: SupabaseService) {}

  async check() {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Verificar conectividade com Supabase
    let database = 'ok';
    try {
      const { error } = await this.supabaseService.getClient()
        .from('app_logs')
        .select('id')
        .limit(1);
      if (error) database = `error: ${error.message}`;
    } catch (e: any) {
      database = `error: ${e.message}`;
    }

    const allOk = database === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      instance: this.instanceId,
      service: this.serviceName,
      uptime_seconds: uptimeSeconds,
      checks: {
        database,
      },
    };
  }
}
