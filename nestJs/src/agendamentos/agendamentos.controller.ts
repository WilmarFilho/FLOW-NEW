import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserGuard } from '../common/guards/user.guard';

@Controller('agendamentos')
@UseGuards(UserGuard)
export class AgendamentosController {
  constructor(private readonly service: AgendamentosService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.service.listAgendamentos(userId);
  }

  @Post()
  async create(@CurrentUserId() userId: string, @Body() dto: any) {
    return this.service.createAgendamento(userId, dto);
  }

  @Put(':id')
  async updateStatus(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() dto: { status: string },
  ) {
    return this.service.updateStatus(userId, id, dto.status);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.deleteAgendamento(userId, id);
  }
}
