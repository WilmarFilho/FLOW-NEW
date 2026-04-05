import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Headers } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { UserGuard } from '../common/guards/user.guard';

@Controller('contatos')
@UseGuards(UserGuard)
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) {}

  @Get()
  async getAllContatos(@Headers('x-user-id') userId: string) {
    return this.contatosService.getAllContatos(userId);
  }

  @Post()
  async createContato(
    @Headers('x-user-id') userId: string,
    @Body() body: { nome: string; whatsapp: string }
  ) {
    return this.contatosService.createContato(userId, body);
  }

  @Post('vincular')
  async vincularContato(
    @Headers('x-user-id') userId: string,
    @Body() body: { contatoId: string; listaId: string }
  ) {
    return this.contatosService.vincularContato(userId, body);
  }

  @Delete('vincular')
  async desvincularContato(
    @Headers('x-user-id') userId: string,
    @Body() body: { contatoId: string; listaId: string }
  ) {
    return this.contatosService.desvincularContato(userId, body);
  }

  @Get('listas')
  async getListas(@Headers('x-user-id') userId: string) {
    return this.contatosService.getListas(userId);
  }

  @Post('listas')
  async createLista(
    @Headers('x-user-id') userId: string, 
    @Body() body: { nome: string; cor: string }
  ) {
    return this.contatosService.createLista(userId, body);
  }

  @Put(':id/listas')
  async setContactLists(
    @Headers('x-user-id') userId: string, 
    @Param('id') id: string, 
    @Body() body: { listaIds: string[] }
  ) {
    return this.contatosService.setContactLists(userId, id, body.listaIds);
  }

  @Put(':id/mover')
  async moveContact(
    @Headers('x-user-id') userId: string, 
    @Param('id') id: string, 
    @Body() body: { sourceListId: string, targetListId: string, newOrder: number }
  ) {
    return this.contatosService.moveContact(userId, id, body);
  }

  @Delete(':id')
  async deleteContact(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string
  ) {
    return this.contatosService.deleteContact(userId, id);
  }
}
