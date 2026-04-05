import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService], // Adicionado para compartilhar
})
export class GoogleModule {}
