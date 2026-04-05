import { Controller, Get, Query, Res, Delete, UseGuards } from '@nestjs/common';
import { GoogleService } from './google.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserGuard } from '../common/guards/user.guard';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('auth-url')
  @UseGuards(UserGuard)
  getAuthUrl(@CurrentUserId() userId: string) {
    const url = this.googleService.getAuthUrl(userId);
    return { url };
  }

  @Get('callback')
  async googleAuthCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    // state -> nosso profileId passado na ida
    try {
      await this.googleService.handleCallback(code, state);
      // Redireciona de volta para a tela de integrações do painel marcando sucesso na aba
      const frontEndUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontEndUrl}/configuracoes?tab=integracoes&success=google`);
    } catch (err) {
      const frontEndUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontEndUrl}/configuracoes?tab=integracoes&error=google`);
    }
  }

  @Get('status')
  @UseGuards(UserGuard)
  async getStatus(@CurrentUserId() userId: string) {
    return this.googleService.getGoogleStatus(userId);
  }

  @Delete('disconnect')
  @UseGuards(UserGuard)
  async disconnect(@CurrentUserId() userId: string) {
    return this.googleService.disconnectGoogle(userId);
  }
}
