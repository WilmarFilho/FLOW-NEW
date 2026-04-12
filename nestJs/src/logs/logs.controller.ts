import { Body, Controller, Post } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './dto/create-log.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  async createClientLog(@Body() payload: CreateLogDto) {
    // Optionally we can extract the user_id from the Request if the endpoint is authenticated,
    // but for now we accept what the frontend sends.
    await this.logsService.createLog(payload);
    return { success: true };
  }
}
