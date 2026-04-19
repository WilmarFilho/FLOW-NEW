import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';
import { LogsModule } from '../logs/logs.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversasController } from './conversas.controller';
import { ConversasService } from './conversas.service';
import { BatchProcessor } from './batch.processor';

@Module({
  imports: [
    LogsModule, 
    ConfigModule, 
    AgendamentosModule, 
    forwardRef(() => WhatsappModule),
    BullModule.registerQueue({ name: 'conversation-batch' })
  ],
  controllers: [ConversasController],
  providers: [ConversasService, BatchProcessor],
  exports: [ConversasService],
})
export class ConversasModule {}
