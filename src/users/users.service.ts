import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        staffProfile: {
          include: {
            skills: true,
            certifiedLocations: true,
          },
        },
        managerLocations: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  async findAllStaff() {
    return this.prisma.user.findMany({
      where: { role: 'STAFF' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        staffProfile: {
          include: {
            skills: true,
            certifiedLocations: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        staffProfile: {
          include: {
            skills: true,
            certifiedLocations: true,
          },
        },
        managerLocations: {
          include: {
            location: true,
          },
        },
      },
    });
  }

  async addSkill(userId: string, skillId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user?.staffProfile) {
      throw new Error('User does not have a staff profile');
    }

    return this.prisma.staffProfile.update({
      where: { id: user.staffProfile.id },
      data: {
        skills: {
          connect: { id: skillId },
        },
      },
      include: {
        skills: true,
        certifiedLocations: true,
      },
    });
  }

  async addLocation(userId: string, locationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user?.staffProfile) {
      throw new Error('User does not have a staff profile');
    }

    await this.prisma.locationCertification.upsert({
      where: {
        staffProfileId_locationId: {
          staffProfileId: user.staffProfile.id,
          locationId,
        },
      },
      create: {
        staffProfileId: user.staffProfile.id,
        locationId,
        certifiedAt: new Date(),
      },
      update: {
        decertifiedAt: null,
      },
    });

    return this.prisma.staffProfile.update({
      where: { id: user.staffProfile.id },
      data: {
        certifiedLocations: {
          connect: { id: locationId },
        },
      },
      include: {
        skills: true,
        certifiedLocations: true,
      },
    });
  }

  async decertifyLocation(userId: string, locationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user?.staffProfile) {
      throw new Error('User does not have a staff profile');
    }

    await this.prisma.locationCertification.updateMany({
      where: {
        staffProfileId: user.staffProfile.id,
        locationId,
        decertifiedAt: null,
      },
      data: {
        decertifiedAt: new Date(),
      },
    });

    return { message: 'Staff de-certified from location. Historical assignments remain viewable.' };
  }

  async syncCertifications() {
    const allStaff = await this.prisma.staffProfile.findMany({
      include: { certifiedLocations: true },
    });

    let synced = 0;

    for (const staff of allStaff) {
      for (const location of staff.certifiedLocations) {
        await this.prisma.locationCertification.upsert({
          where: {
            staffProfileId_locationId: {
              staffProfileId: staff.id,
              locationId: location.id,
            },
          },
          create: {
            staffProfileId: staff.id,
            locationId: location.id,
            certifiedAt: new Date(),
          },
          update: {},
        });
        synced++;
      }
    }

    return { message: `Synced ${synced} certifications to LocationCertification table` };
  }
}
