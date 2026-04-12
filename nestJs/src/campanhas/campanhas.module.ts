import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LogsModule } from '../logs/logs.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CampanhasController } from './campanhas.controller';
import { CampanhasService } from './campanhas.service';

@Module({
  imports: [SupabaseModule, WhatsappModule, LogsModule, ConfigModule],
  controllers: [CampanhasController],
  providers: [CampanhasService],
})
export class CampanhasModule {}
