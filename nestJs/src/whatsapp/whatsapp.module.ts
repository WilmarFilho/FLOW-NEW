import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionApiService } from './evolution-api.service';
import { LogsModule } from '../logs/logs.module';
import { WhatsappWebhookGuard } from '../common/guards/whatsapp-webhook.guard';

@Module({
  imports: [LogsModule, ConfigModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionApiService, WhatsappWebhookGuard],
  exports: [WhatsappService, EvolutionApiService],
})
export class WhatsappModule {}
