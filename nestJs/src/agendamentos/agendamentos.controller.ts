import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';

@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly service: AgendamentosService) {}

  private validateAuth(userId: string) {
    if (!userId) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
  }

  @Get()
  async list(@Headers('x-user-id') userId: string) {
    this.validateAuth(userId);
    return this.service.listAgendamentos(userId);
  }

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() dto: any,
  ) {
    this.validateAuth(userId);
    return this.service.createAgendamento(userId, dto);
  }

  @Put(':id')
  async updateStatus(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: { status: string },
  ) {
    this.validateAuth(userId);
    return this.service.updateStatus(userId, id, dto.status);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateAuth(userId);
    return this.service.deleteAgendamento(userId, id);
  }
}
