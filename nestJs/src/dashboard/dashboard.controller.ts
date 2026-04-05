import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { UserGuard } from '../common/guards/user.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(UserGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(
    @CurrentUserId() userId: string,
    @Query('range') range?: string,
  ) {
    return this.dashboardService.getDashboard(userId, range);
  }
}
