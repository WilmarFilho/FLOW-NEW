import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogsModule } from './logs/logs.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConhecimentosModule } from './conhecimentos/conhecimentos.module';
import { AtendentesModule } from './atendentes/atendentes.module';
import { HelpModule } from './help/help.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    LogsModule,
    WhatsappModule,
    ConhecimentosModule,
    AtendentesModule,
    HelpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
