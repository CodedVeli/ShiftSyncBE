import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { PublishScheduleDto } from './dto/publish-schedule.dto';
import { OverrideAssignmentDto } from './dto/override-assignment.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/user.types';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Post()
  create(@Body() dto: CreateShiftDto, @CurrentUser('id') userId: string) {
    return this.shiftsService.create(dto, userId);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.shiftsService.findAll(user, locationId, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @Post(':id/assign')
  assignStaff(
    @Param('id') id: string,
    @Body() dto: AssignStaffDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shiftsService.assignStaff(id, dto.staffId, userId);
  }

  @Delete(':id/assign/:staffId')
  unassignStaff(@Param('id') id: string, @Param('staffId') staffId: string) {
    return this.shiftsService.unassignStaff(id, staffId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<CreateShiftDto>) {
    return this.shiftsService.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.shiftsService.delete(id);
  }

  @Post('publish')
  publishSchedule(@Body() dto: PublishScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.publishSchedule(dto, user);
  }

  @Post(':id/override')
  overrideAssignment(
    @Param('id') id: string,
    @Body() dto: OverrideAssignmentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.shiftsService.overrideAssignment(id, dto, user);
  }
}
