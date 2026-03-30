import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { CreateWhatsappDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsappDto } from './dto/update-whatsapp.dto';
import { TestMessageDto } from './dto/test-message.dto';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * GET /whatsapp
   * Lista conexões do usuário (user_id vem do header por ora)
   */
  @Get()
  async listConnections(@Headers('x-user-id') userId: string) {
    return this.whatsappService.listConnections(userId);
  }

  /**
   * POST /whatsapp
   * Cria nova instância + conexão
   */
  @Post()
  async createConnection(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateWhatsappDto,
  ) {
    dto.user_id = userId;
    return this.whatsappService.createConnection(dto);
  }

  /**
   * PUT /whatsapp/:id
   * Edita uma conexão existente
   */
  @Put(':id')
  async updateConnection(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateWhatsappDto,
  ) {
    return this.whatsappService.updateConnection(id, userId, dto);
  }

  /**
   * DELETE /whatsapp/:id
   * Deleta conexão e instância na Evolution
   */
  @Delete(':id')
  async deleteConnection(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.whatsappService.deleteConnection(id, userId);
  }

  /**
   * POST /whatsapp/:id/test
   * Envia mensagem de teste
   */
  @Post(':id/test')
  async sendTestMessage(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: TestMessageDto,
  ) {
    return this.whatsappService.sendTestMessage(id, userId, dto.number, dto.message);
  }

  /**
   * POST /whatsapp/webhook
   * Recebe eventos da Evolution API (connection.update, qrcode.updated, etc)
   */
  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    return this.whatsappService.handleWebhook(payload);
  }
}
