import { Module } from '@nestjs/common';
import { ContatosController } from './contatos.controller';
import { ContatosService } from './contatos.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ContatosController],
  providers: [ContatosService],
})
export class ContatosModule {}
