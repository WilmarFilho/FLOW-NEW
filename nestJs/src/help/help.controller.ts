import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { HelpService } from './help.service';
import { UserGuard } from '../common/guards/user.guard';

@Controller('help')
@UseGuards(UserGuard)
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post('ask')
  async ask(
    @Headers('x-user-id') userId: string,
    @Body('question') question: string,
  ) {
    if (!question) {
      return { answer: 'Por favor, envie sua dúvida.' };
    }
    return this.helpService.askQuestion(userId, question);
  }
}
