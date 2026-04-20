import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserGuard } from '../common/guards/user.guard';
import {
  CreateConversaDto,
  SendConversaMessageDto,
  ToggleConversaAiDto,
  UpdateConversaAssignmentDto,
} from './dto/create-conversa.dto';
import {
  ListConversasParams,
  ListMensagensParams,
} from './dto/list-conversas.dto';
import { ConversasService } from './conversas.service';

@Controller('conversas')
@UseGuards(UserGuard)
export class ConversasController {
  constructor(private readonly conversasService: ConversasService) {}

  @Get()
  async listConversas(
    @CurrentUserId() userId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const params: ListConversasParams = {
      assignedUserId: query.assignedUserId || undefined,
      filter:
        query.filter === 'mine' ||
        query.filter === 'unread' ||
        query.filter === 'ai' ||
        query.filter === 'deleted' ||
        query.filter === 'all'
          ? query.filter
          : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      search: query.search || undefined,
      whatsappConnectionId: query.whatsappConnectionId || undefined,
    };

    return this.conversasService.listConversas(userId, params);
  }

  @Get('options')
  async getOptions(@CurrentUserId() userId: string) {
    return this.conversasService.getConversationOptions(userId);
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
    @Query() query: Record<string, string | undefined>,
  ) {
    const params: ListMensagensParams = {
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    };

    return this.conversasService.listMensagens(userId, conversaId, params);
  }

  @Get(':id/messages/:messageId')
  async getMensagem(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversasService.getMensagem(userId, conversaId, messageId);
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

  @Patch(':id/assignment')
  async updateAssignment(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Body() dto: UpdateConversaAssignmentDto,
  ) {
    return this.conversasService.updateAssignment(
      userId,
      conversaId,
      dto.assigned_user_id,
    );
  }

  @Post(':id/messages')
  async sendMensagem(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Body() dto: SendConversaMessageDto,
  ) {
    return this.conversasService.sendMensagem(
      userId,
      conversaId,
      dto.content,
      dto.reply_to_message_id,
    );
  }

  @Post(':id/messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadMensagem(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
    @Body('reply_to_message_id') replyToMessageId?: string,
  ) {
    return this.conversasService.sendMediaMessage(
      userId,
      conversaId,
      file,
      caption,
      replyToMessageId,
    );
  }

  @Delete(':id/messages/:messageId')
  async deleteMensagem(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.conversasService.deleteMessage(userId, conversaId, messageId);
  }

  @Delete(':id')
  async deleteConversa(
    @CurrentUserId() userId: string,
    @Param('id') conversaId: string,
  ) {
    return this.conversasService.deleteConversa(userId, conversaId);
  }
}
