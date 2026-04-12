import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';

@Module({
  providers: [LogsService],
  controllers: [LogsController],
  exports: [LogsService], // export so it can be injected in the global App Filter
})
export class LogsModule {}
