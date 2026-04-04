import { Controller, Get } from '@nestjs/common';
import { AgentesIaService } from './agentes-ia.service';

@Controller('agentes-ia')
export class AgentesIaController {
  constructor(private readonly agentesIaService: AgentesIaService) {}

  @Get()
  findAll() {
    return this.agentesIaService.findAll();
  }
}
