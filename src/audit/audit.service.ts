import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async createLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    beforeState?: any,
    afterState?: any,
    shiftId?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        beforeState,
        afterState,
        shiftId,
      },
    });
  }

  async findByShift(shiftId: string) {
    return this.prisma.auditLog.findMany({
      where: { shiftId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findAll(limit = 100) {
    return this.prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            location: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async exportLogs(startDate?: Date, endDate?: Date) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}
