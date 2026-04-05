import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserGuard } from '../common/guards/user.guard';
import {
  CreateConversaDto,
  SendConversaMessageDto,
  ToggleConversaAiDto,
} from './dto/create-conversa.dto';
import { ConversasService } from './conversas.service';

@Controller('conversas')
@UseGuards(UserGuard)
export class ConversasController {
  constructor(private readonly conversasService: ConversasService) {}

  @Get()
  async listConversas(@CurrentUserId() userId: string) {
    return this.conversasService.listConversas(userId);
  }

  @Post()
  async createConversa(
    @CurrentUserId() userId: string,
    @Body() dto: CreateConversaDto,
  ) {
    return this.conversasService.createConversa(userId, dto);
  }

  @Get(':id')
  async getConversa(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
  ) {
    return this.conversasService.getConversa(userId, conversaId);
  }

  @Get(':id/messages')
  async getMensagens(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
  ) {
    return this.conversasService.listMensagens(userId, conversaId);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
  ) {
    return this.conversasService.markAsRead(userId, conversaId);
  }

  @Patch(':id/ai')
  async toggleAi(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Body() dto: ToggleConversaAiDto,
  ) {
    return this.conversasService.toggleAi(userId, conversaId, dto.enabled);
  }

  @Post(':id/messages')
  async sendMensagem(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Body() dto: SendConversaMessageDto,
  ) {
    return this.conversasService.sendMensagem(userId, conversaId, dto.content);
  }
}

