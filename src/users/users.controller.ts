import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('staff/list')
  findAllStaff() {
    return this.usersService.findAllStaff();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/skills')
  addSkill(@Param('id') id: string, @Body('skillId') skillId: string) {
    return this.usersService.addSkill(id, skillId);
  }

  @Post(':id/locations')
  addLocation(@Param('id') id: string, @Body('locationId') locationId: string) {
    return this.usersService.addLocation(id, locationId);
  }

  @Delete(':id/locations/:locationId')
  @Roles(Role.ADMIN, Role.MANAGER)
  decertifyLocation(@Param('id') id: string, @Param('locationId') locationId: string) {
    return this.usersService.decertifyLocation(id, locationId);
  }

  @Post('sync-certifications')
  @Roles(Role.ADMIN)
  syncCertifications() {
    return this.usersService.syncCertifications();
  }
}
