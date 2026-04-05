/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { CampanhasService } from './campanhas.service';
import { CreateCampanhaDto } from './dto/create-campanha.dto';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('campanhas')
@UseGuards(AdminGuard)
export class CampanhasController {
  constructor(private readonly campanhasService: CampanhasService) {}

  @Get()
  async listCampaigns(@CurrentUserId() userId: string) {
    return this.campanhasService.listCampaigns(userId);
  }

  @Get(':id')
  async getCampaignById(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.campanhasService.getCampaignById(userId, id);
  }

  @Post()
  async createCampaign(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCampanhaDto,
  ) {
    return this.campanhasService.createCampaign(userId, dto);
  }

  @Post(':id/start')
  async startCampaign(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.campanhasService.startCampaign(userId, id);
  }
}
