import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AtendentesService } from './atendentes.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('atendentes')
@UseGuards(AdminGuard)
export class AtendentesController {
  constructor(private readonly service: AtendentesService) {}

  @Get()
  async list(@Headers('x-user-id') userId: string) {
    return this.service.listAtendentes(userId);
  }

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() dto: any,
  ) {
    return this.service.createAtendente(userId, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: any,
  ) {
    return this.service.updateAtendente(userId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.deleteAtendente(userId, id);
  }
}

