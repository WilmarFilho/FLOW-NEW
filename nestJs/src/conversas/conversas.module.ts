import { forwardRef, Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConversasController } from './conversas.controller';
import { ConversasService } from './conversas.service';

@Module({
  imports: [LogsModule, forwardRef(() => WhatsappModule)],
  controllers: [ConversasController],
  providers: [ConversasService],
  exports: [ConversasService],
})
export class ConversasModule {}

