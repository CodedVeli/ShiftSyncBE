import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/user.types';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOnDutyStaff(user: AuthenticatedUser) {
    const now = new Date();

    const where: any = {
      startTime: { lte: now },
      endTime: { gte: now },
    };

    if (user.role === 'MANAGER') {
      const managedLocations = await this.prisma.managerLocation.findMany({
        where: { userId: user.id },
        select: { locationId: true },
      });
      where.locationId = { in: managedLocations.map(ml => ml.locationId) };
    } else if (user.role === 'STAFF') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: { certifiedLocations: { select: { id: true } } },
      });
      const certifiedLocationIds = staffProfile?.certifiedLocations.map(loc => loc.id) || [];
      where.locationId = { in: certifiedLocationIds };
    }

    const activeShifts = await this.prisma.shift.findMany({
      where,
      include: {
        location: true,
        requiredSkill: true,
        assignments: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const byLocation = activeShifts.reduce((acc, shift) => {
      const locationId = shift.location.id;
      if (!acc[locationId]) {
        acc[locationId] = {
          location: shift.location,
          shifts: [],
          totalStaff: 0,
        };
      }

      acc[locationId].shifts.push({
        id: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        requiredSkill: shift.requiredSkill.name,
        staff: shift.assignments.map((a) => a.staff),
      });

      acc[locationId].totalStaff += shift.assignments.length;

      return acc;
    }, {});

    return Object.values(byLocation);
  }
}
