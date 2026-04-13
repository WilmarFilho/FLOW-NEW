import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AtendentesService } from './atendentes.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { CreateAtendenteDto } from './dto/create-atendente.dto';
import { UpdateAtendenteDto } from './dto/update-atendente.dto';

@Controller('atendentes')
@UseGuards(AdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
export class AtendentesController {
  constructor(private readonly service: AtendentesService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.service.listAtendentes(userId);
  }

  @Post()
  async create(@CurrentUserId() userId: string, @Body() dto: CreateAtendenteDto) {
    return this.service.createAtendente(userId, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateAtendenteDto,
  ) {
    return this.service.updateAtendente(userId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.deleteAtendente(userId, id);
  }
}
