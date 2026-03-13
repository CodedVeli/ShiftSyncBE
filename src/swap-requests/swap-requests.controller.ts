import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { SwapRequestsService } from './swap-requests.service';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('swap-requests')
@UseGuards(JwtAuthGuard)
export class SwapRequestsController {
  constructor(private swapRequestsService: SwapRequestsService) {}

  @Post()
  create(@Body() dto: CreateSwapRequestDto, @CurrentUser('id') userId: string) {
    return this.swapRequestsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @CurrentUser('role') userRole: string) {
    return this.swapRequestsService.findAll(userId, userRole as any);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.swapRequestsService.accept(id, userId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.swapRequestsService.approve(id, userId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.swapRequestsService.cancel(id, userId);
  }
}
