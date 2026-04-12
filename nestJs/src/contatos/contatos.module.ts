import { Module } from '@nestjs/common';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';
import { LogsModule } from '../logs/logs.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, LogsModule],
  controllers: [ContatosController],
  providers: [ContatosService],
})
export class ContatosModule {}
