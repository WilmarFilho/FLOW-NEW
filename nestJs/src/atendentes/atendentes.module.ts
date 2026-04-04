import { Module } from '@nestjs/common';
import { AtendentesService } from './atendentes.service';
import { AtendentesController } from './atendentes.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AtendentesService],
  controllers: [AtendentesController]
})
export class AtendentesModule {}
