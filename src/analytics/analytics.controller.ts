import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overtime')
  getOvertimeAnalytics(
    @Query('locationId') locationId?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    const start = weekStart ? new Date(weekStart) : undefined;
    return this.analyticsService.getOvertimeAnalytics(locationId, start);
  }

  @Get('fairness')
  getFairnessAnalytics(
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getFairnessAnalytics(locationId, start, end);
  }

  @Get('hours-distribution')
  getHoursDistribution(
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.analyticsService.getHoursDistribution(locationId, start, end);
  }
}
