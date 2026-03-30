import { Module } from '@nestjs/common';
import { ConhecimentosController } from './conhecimentos.controller';
import { ConhecimentosService } from './conhecimentos.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  controllers: [ConhecimentosController],
  providers: [ConhecimentosService],
  exports: [ConhecimentosService],
})
export class ConhecimentosModule {}
