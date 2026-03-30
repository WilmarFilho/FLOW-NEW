import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private clientInstance: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Variáveis do Supabase faltando no ambiente NestJS. Verifique .env');
    }

    this.clientInstance = createClient(
      supabaseUrl || 'https://mock.supabase.co',
      supabaseKey || 'mock-service-key'
    );
  }

  getClient(): SupabaseClient {
    return this.clientInstance;
  }
}
