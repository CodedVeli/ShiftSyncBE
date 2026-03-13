import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('shift/:id')
  findByShift(@Param('id') id: string) {
    return this.auditService.findByShift(id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  findAll(@Query('limit') limit?: string) {
    return this.auditService.findAll(limit ? parseInt(limit) : 100);
  }

  @Get('export')
  @Roles(Role.ADMIN)
  exportLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.auditService.exportLogs(start, end);
  }
}
