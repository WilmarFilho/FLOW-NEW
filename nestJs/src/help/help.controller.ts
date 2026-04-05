import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HelpService } from './help.service';
import { UserGuard } from '../common/guards/user.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('help')
@UseGuards(UserGuard)
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post('ask')
  async ask(
    @CurrentUserId() userId: string,
    @Body('question') question: string,
  ) {
    if (!question) {
      return { answer: 'Por favor, envie sua dúvida.' };
    }
    return this.helpService.askQuestion(userId, question);
  }
}
