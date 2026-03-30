import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConhecimentosService } from './conhecimentos.service';
import {
  CreateConhecimentoDto,
  UpdateConhecimentoDto,
  SendMessageDto,
} from './dto/conhecimento.dto';

@Controller('conhecimentos')
export class ConhecimentosController {
  constructor(private readonly service: ConhecimentosService) {}

  /** GET /conhecimentos — Lista bases do usuário */
  @Get()
  async list(@Headers('x-user-id') userId: string) {
    return this.service.list(userId);
  }

  /** GET /conhecimentos/:id — Detalhes de uma base */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.getById(id, userId);
  }

  /** POST /conhecimentos — Cria nova base */
  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateConhecimentoDto,
  ) {
    dto.user_id = userId;
    return this.service.create(dto);
  }

  /** PUT /conhecimentos/:id — Atualiza base */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateConhecimentoDto,
  ) {
    return this.service.update(id, userId, dto);
  }

  /** DELETE /conhecimentos/:id — Deleta base */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.delete(id, userId);
  }

  /** GET /conhecimentos/:id/messages — Histórico do chat */
  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.service.getMessages(id);
  }

  /** POST /conhecimentos/:id/messages — Envia mensagem de texto */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(id, userId, dto.content);
  }

  /** POST /conhecimentos/:id/start — Inicia ou retoma conversa */
  @Post(':id/start')
  async startConversation(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.service.startConversation(id, userId);
  }

  /** POST /conhecimentos/:id/upload — Upload de arquivo */
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.processFileUpload(id, userId, file);
  }
}
