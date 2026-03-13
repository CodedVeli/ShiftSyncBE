import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/user.types';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const where: any = {};

    if (user.role === 'MANAGER') {
      const managedLocations = await this.prisma.managerLocation.findMany({
        where: { userId: user.id },
        select: { locationId: true },
      });
      where.id = { in: managedLocations.map(ml => ml.locationId) };
    } else if (user.role === 'STAFF') {
      const staffProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: { certifiedLocations: { select: { id: true } } },
      });
      const certifiedLocationIds = staffProfile?.certifiedLocations.map(loc => loc.id) || [];
      where.id = { in: certifiedLocationIds };
    }

    return this.prisma.location.findMany({
      where,
      include: {
        managers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.location.findUnique({
      where: { id },
      include: {
        managers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        certifiedStaff: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: { name: string; timezone: string; address: string }) {
    return this.prisma.location.create({
      data,
    });
  }
}
