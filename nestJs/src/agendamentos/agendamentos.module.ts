import { Module } from '@nestjs/common';
import { AgendamentosController } from './agendamentos.controller';
import { AgendamentosService } from './agendamentos.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [SupabaseModule, GoogleModule],
  controllers: [AgendamentosController],
  providers: [AgendamentosService],
  exports: [AgendamentosService],
})
export class AgendamentosModule {}
