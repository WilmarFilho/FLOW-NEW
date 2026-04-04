import { Module } from '@nestjs/common';
import { AgentesIaService } from './agentes-ia.service';
import { AgentesIaController } from './agentes-ia.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AgentesIaController],
  providers: [AgentesIaService],
})
export class AgentesIaModule {}
