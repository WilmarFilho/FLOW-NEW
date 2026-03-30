import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionApiService } from './evolution-api.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionApiService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
