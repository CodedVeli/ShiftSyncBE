import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ShiftValidationService } from './shift-validation.service';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AvailabilityModule, NotificationsModule, AuditModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftValidationService],
  exports: [ShiftsService, ShiftValidationService],
})
export class ShiftsModule {}
