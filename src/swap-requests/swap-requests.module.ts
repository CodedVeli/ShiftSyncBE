import { Module } from '@nestjs/common';
import { SwapRequestsService } from './swap-requests.service';
import { SwapRequestsController } from './swap-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SwapRequestsController],
  providers: [SwapRequestsService],
  exports: [SwapRequestsService],
})
export class SwapRequestsModule {}
