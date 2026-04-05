import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';
import { LogsModule } from '../logs/logs.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversasController } from './conversas.controller';
import { ConversasService } from './conversas.service';

@Module({
  imports: [LogsModule, ConfigModule, AgendamentosModule, forwardRef(() => WhatsappModule)],
  controllers: [ConversasController],
  providers: [ConversasService],
  exports: [ConversasService],
})
export class ConversasModule {}
