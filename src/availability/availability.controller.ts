import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Post()
  create(@Body() dto: CreateAvailabilityDto, @CurrentUser('id') userId: string) {
    return this.availabilityService.create(userId, dto);
  }

  @Get('me')
  findMine(@CurrentUser('id') userId: string) {
    return this.availabilityService.findByUser(userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAvailabilityDto>) {
    return this.availabilityService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.availabilityService.delete(id);
  }
}
