import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { UserGuard } from '../common/guards/user.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('contatos')
@UseGuards(UserGuard)
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) {}

  @Get()
  async getAllContatos(@CurrentUserId() userId: string) {
    return this.contatosService.getAllContatos(userId);
  }

  @Post()
  async createContato(
    @CurrentUserId() userId: string,
    @Body() body: { nome: string; whatsapp: string }
  ) {
    return this.contatosService.createContato(userId, body);
  }

  @Patch(':id')
  async updateContato(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: { nome: string },
  ) {
    return this.contatosService.updateContato(userId, id, body);
  }

  @Get(':id/details')
  async getContatoDetails(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.contatosService.getContatoDetails(userId, id);
  }

  @Post('vincular')
  async vincularContato(
    @CurrentUserId() userId: string,
    @Body() body: { contatoId: string; listaId: string }
  ) {
    return this.contatosService.vincularContato(userId, body);
  }

  @Delete('vincular')
  async desvincularContato(
    @CurrentUserId() userId: string,
    @Body() body: { contatoId: string; listaId: string }
  ) {
    return this.contatosService.desvincularContato(userId, body);
  }

  @Get('listas')
  async getListas(@CurrentUserId() userId: string) {
    return this.contatosService.getListas(userId);
  }

  @Post('listas')
  async createLista(
    @CurrentUserId() userId: string, 
    @Body() body: { nome: string; cor: string; descricao?: string | null }
  ) {
    return this.contatosService.createLista(userId, body);
  }

  @Post('qualificacao/automatica')
  async startAutomaticQualification(@CurrentUserId() userId: string) {
    return this.contatosService.startAutomaticQualification(userId);
  }

  @Get('qualificacao/automatica/:jobId')
  async getAutomaticQualificationStatus(
    @CurrentUserId() userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.contatosService.getAutomaticQualificationStatus(userId, jobId);
  }

  @Delete('listas/:id')
  async deleteLista(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.contatosService.deleteLista(userId, id);
  }

  @Put(':id/listas')
  async setContactLists(
    @CurrentUserId() userId: string, 
    @Param('id') id: string, 
    @Body() body: { listaIds: string[] }
  ) {
    return this.contatosService.setContactLists(userId, id, body.listaIds);
  }

  @Put(':id/mover')
  async moveContact(
    @CurrentUserId() userId: string, 
    @Param('id') id: string, 
    @Body() body: { sourceListId: string, targetListId: string, newOrder: number }
  ) {
    return this.contatosService.moveContact(userId, id, body);
  }

  @Delete(':id')
  async deleteContact(
    @CurrentUserId() userId: string,
    @Param('id') id: string
  ) {
    return this.contatosService.deleteContact(userId, id);
  }
}
