import { Controller, Get, Query, Res, Headers, Delete } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('auth-url')
  getAuthUrl(@Headers('x-user-id') userId: string) {
    if (!userId) return { url: null };
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
  async getStatus(@Headers('x-user-id') userId: string) {
    if (!userId) return { connected: false };
    return this.googleService.getGoogleStatus(userId);
  }

  @Delete('disconnect')
  async disconnect(@Headers('x-user-id') userId: string) {
    return this.googleService.disconnectGoogle(userId);
  }
}
