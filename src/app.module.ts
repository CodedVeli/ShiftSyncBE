import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SkillsModule } from './skills/skills.module';
import { AvailabilityModule } from './availability/availability.module';
import { SwapRequestsModule } from './swap-requests/swap-requests.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    ShiftsModule,
    SkillsModule,
    AvailabilityModule,
    SwapRequestsModule,
    AnalyticsModule,
    NotificationsModule,
    AuditModule,
    DashboardModule,
  ],
})
export class AppModule {}
