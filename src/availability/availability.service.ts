import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateAvailabilityDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user?.staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.prisma.availability.create({
      data: {
        staffProfileId: user.staffProfile.id,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isException: dto.isException || false,
        exceptionDate: dto.exceptionDate ? new Date(dto.exceptionDate) : null,
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
      },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user?.staffProfile) {
      return [];
    }

    return this.prisma.availability.findMany({
      where: { staffProfileId: user.staffProfile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async update(id: string, dto: Partial<CreateAvailabilityDto>) {
    return this.prisma.availability.update({
      where: { id },
      data: {
        ...(dto.dayOfWeek !== undefined && { dayOfWeek: dto.dayOfWeek }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.isException !== undefined && { isException: dto.isException }),
        ...(dto.exceptionDate && { exceptionDate: new Date(dto.exceptionDate) }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.availability.delete({
      where: { id },
    });
  }

  async checkAvailability(staffId: string, shiftStart: Date, shiftEnd: Date, locationTimezone: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: {
        staffProfile: {
          include: { availabilities: true },
        },
      },
    });

    if (!user?.staffProfile) return false;

    const dayOfWeek = shiftStart.getDay();
    const shiftStartTime = shiftStart.toTimeString().slice(0, 5);
    const shiftEndTime = shiftEnd.toTimeString().slice(0, 5);

    const exceptionAvail = user.staffProfile.availabilities.find(
      (a) => a.isException && a.exceptionDate && 
      new Date(a.exceptionDate).toDateString() === shiftStart.toDateString()
    );

    if (exceptionAvail) {
      if (!exceptionAvail.isAvailable) return false;
      if (exceptionAvail.startTime && exceptionAvail.endTime) {
        return shiftStartTime >= exceptionAvail.startTime && shiftEndTime <= exceptionAvail.endTime;
      }
      return true;
    }

    const recurringAvail = user.staffProfile.availabilities.find(
      (a) => !a.isException && a.dayOfWeek === dayOfWeek
    );

    if (!recurringAvail) return false;
    if (!recurringAvail.isAvailable) return false;
    if (recurringAvail.startTime && recurringAvail.endTime) {
      return shiftStartTime >= recurringAvail.startTime && shiftEndTime <= recurringAvail.endTime;
    }

    return true;
  }
}
