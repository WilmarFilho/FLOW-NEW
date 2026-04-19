import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionApiService } from './evolution-api.service';
import { EvolutionRoutingService } from './evolution-routing.service';
import { LogsModule } from '../logs/logs.module';
import { WhatsappWebhookGuard } from '../common/guards/whatsapp-webhook.guard';
import { ConversasModule } from '../conversas/conversas.module';

@Module({
  imports: [LogsModule, ConfigModule, forwardRef(() => ConversasModule)],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    EvolutionApiService,
    EvolutionRoutingService,
    WhatsappWebhookGuard,
  ],
  exports: [WhatsappService, EvolutionApiService, EvolutionRoutingService],
})
export class WhatsappModule {}
