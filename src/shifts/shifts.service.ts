import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftValidationService } from './shift-validation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AuditService } from '../audit/audit.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { PublishScheduleDto } from './dto/publish-schedule.dto';
import { OverrideAssignmentDto } from './dto/override-assignment.dto';
import { AuthenticatedUser } from '../common/types/user.types';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private validationService: ShiftValidationService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateShiftDto, userId: string) {
    const shift = await this.prisma.shift.create({
      data: {
        locationId: dto.locationId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        requiredSkillId: dto.requiredSkillId,
        headcountNeeded: dto.headcountNeeded,
        isPublished: dto.isPublished || false,
        publishCutoffHours: dto.publishCutoffHours || 48,
        createdById: userId,
        isPremium: this.checkIfPremium(new Date(dto.startTime)),
      },
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
              },
            },
          },
        },
      },
    });

    this.notificationsGateway.emitToLocation(shift.locationId, 'schedule-updated', {
      action: 'created',
      shift,
    });

    return shift;
  }

  async findAll(user: AuthenticatedUser, locationId?: string, startDate?: string, endDate?: string) {
    const baseWhere: any = {
      ...(locationId && { locationId }),
      ...(startDate && { startTime: { gte: new Date(startDate) } }),
      ...(endDate && { endTime: { lte: new Date(endDate) } }),
    };

    if (user.role === 'STAFF') {
      baseWhere.assignments = { some: { staffId: user.id } };
    } else if (user.role === 'MANAGER') {
      const managedLocations = await this.prisma.managerLocation.findMany({
        where: { userId: user.id },
        select: { locationId: true },
      });
      const locationIds = managedLocations.map(ml => ml.locationId);
      baseWhere.locationId = { in: locationIds };
    }

    return this.prisma.shift.findMany({
      where: baseWhere,
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
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.shift.findUnique({
      where: { id },
      include: {
        location: true,
        requiredSkill: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
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
    });
  }

  async assignStaff(shiftId: string, staffId: string, assignedBy: string) {
    const validation = await this.validationService.validateAssignment(shiftId, staffId);

    if (!validation.valid) {
      throw new BadRequestException({
        message: validation.error,
        suggestions: validation.suggestions,
      });
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        shiftId,
        staffId,
        assignedBy,
      },
      include: {
        shift: {
          include: {
            location: true,
            requiredSkill: true,
          },
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    this.notificationsGateway.emitToLocation(assignment.shift.locationId, 'assignment-changed', {
      shiftId,
      staffId,
      action: 'assigned',
      shift: assignment.shift,
    });

    this.notificationsGateway.emitToUser(staffId, 'shift-assigned', {
      shift: assignment.shift,
    });

    await this.notificationsService.create(
      staffId,
      'SHIFT_ASSIGNED',
      'New Shift Assignment',
      `You have been assigned to a shift at ${assignment.shift.location.name} on ${new Date(assignment.shift.startTime).toLocaleDateString()}`,
    );

    return {
      assignment,
      warnings: validation.warnings,
    };
  }

  async unassignStaff(shiftId: string, staffId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: { locationId: true },
    });

    const result = await this.prisma.shiftAssignment.deleteMany({
      where: {
        shiftId,
        staffId,
      },
    });

    if (shift) {
      this.notificationsGateway.emitToLocation(shift.locationId, 'assignment-changed', {
        shiftId,
        staffId,
        action: 'unassigned',
      });

      this.notificationsGateway.emitToUser(staffId, 'shift-unassigned', {
        shiftId,
      });

      await this.notificationsService.create(
        staffId,
        'SHIFT_REMOVED',
        'Shift Assignment Removed',
        'You have been removed from a shift assignment',
      );
    }

    return result;
  }

  async update(id: string, data: Partial<CreateShiftDto>) {
    const originalShift = await this.prisma.shift.findUnique({ where: { id } });

    const significantChange = !!(
      data.locationId ||
      data.startTime ||
      data.endTime ||
      data.requiredSkillId
    );

    if (significantChange) {
      const affectedSwaps = await this.prisma.swapRequest.findMany({
        where: {
          shiftId: id,
          status: { in: ['PENDING', 'TARGET_ACCEPTED'] },
        },
        include: {
          requester: { select: { id: true, firstName: true, lastName: true } },
          targetStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      for (const swap of affectedSwaps) {
        await this.prisma.swapRequest.update({
          where: { id: swap.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });

        await this.notificationsService.create(
          swap.requesterId,
          'SWAP_CANCELLED',
          'Swap Cancelled - Shift Changed',
          'Your swap request was cancelled because the shift details were modified',
        );

        if (swap.targetStaffId) {
          await this.notificationsService.create(
            swap.targetStaffId,
            'SWAP_CANCELLED',
            'Swap Cancelled - Shift Changed',
            'A swap request was cancelled because the shift details were modified',
          );
        }
      }
    }

    const shift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...(data.locationId && { locationId: data.locationId }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.requiredSkillId && { requiredSkillId: data.requiredSkillId }),
        ...(data.headcountNeeded && { headcountNeeded: data.headcountNeeded }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.publishCutoffHours && { publishCutoffHours: data.publishCutoffHours }),
      },
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
              },
            },
          },
        },
      },
    });

    this.notificationsGateway.emitToLocation(shift.locationId, 'schedule-updated', {
      action: 'updated',
      shift,
    });

    if (shift.assignments && shift.assignments.length > 0) {
      await Promise.all(
        shift.assignments.map(assignment =>
          this.notificationsService.create(
            assignment.staff.id,
            'SHIFT_CHANGED',
            'Shift Details Updated',
            `A shift you are assigned to at ${shift.location.name} has been updated`,
          )
        )
      );
    }

    return shift;
  }

  async delete(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: { locationId: true },
    });

    const result = await this.prisma.shift.delete({
      where: { id },
    });

    if (shift) {
      this.notificationsGateway.emitToLocation(shift.locationId, 'schedule-updated', {
        action: 'deleted',
        shiftId: id,
      });
    }

    return result;
  }

  async publishSchedule(dto: PublishScheduleDto, user: AuthenticatedUser) {
    const shifts = await this.prisma.shift.findMany({
      where: { id: { in: dto.shiftIds } },
      include: {
        location: true,
        assignments: { include: { staff: true } },
      },
    });

    if (user.role === 'MANAGER') {
      const locationIds = shifts.map(s => s.locationId);
      const uniqueLocationIds = [...new Set(locationIds)];

      const managedLocations = await this.prisma.managerLocation.findMany({
        where: { userId: user.id, locationId: { in: uniqueLocationIds } },
      });

      if (managedLocations.length !== uniqueLocationIds.length) {
        throw new ForbiddenException('Cannot publish shifts at unmanaged locations');
      }
    }

    await this.prisma.shift.updateMany({
      where: { id: { in: dto.shiftIds } },
      data: { isPublished: true },
    });

    const staffIds = new Set<string>();
    shifts.forEach(shift => {
      shift.assignments.forEach(a => staffIds.add(a.staffId));
    });

    await Promise.all(
      Array.from(staffIds).map(staffId =>
        this.notificationsService.create(
          staffId,
          'SCHEDULE_PUBLISHED',
          'Schedule Published',
          'Your schedule for the week has been published',
        )
      )
    );

    return { published: dto.shiftIds.length };
  }

  async overrideAssignment(shiftId: string, dto: OverrideAssignmentDto, manager: AuthenticatedUser) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { location: true },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (manager.role === 'MANAGER') {
      const hasPermission = await this.prisma.managerLocation.findFirst({
        where: { userId: manager.id, locationId: shift.locationId },
      });
      if (!hasPermission) {
        throw new ForbiddenException('Not authorized for this location');
      }
    }

    const existingAssignment = await this.prisma.shiftAssignment.findUnique({
      where: {
        shiftId_staffId: {
          shiftId,
          staffId: dto.staffId,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Staff is already assigned to this shift');
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        shiftId,
        staffId: dto.staffId,
        assignedBy: manager.id,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: {
          include: {
            location: true,
            requiredSkill: true,
          },
        },
      },
    });

    await this.auditService.createLog(
      manager.id,
      'OVERRIDE_ASSIGNMENT',
      'SHIFT',
      shiftId,
      null,
      {
        staffId: dto.staffId,
        reason: dto.reason,
        constraintViolated: dto.constraintViolated,
        overriddenBy: `${manager.firstName} ${manager.lastName}`,
      },
      shiftId,
    );

    this.notificationsGateway.emitToLocation(assignment.shift.locationId, 'assignment-changed', {
      shiftId,
      staffId: dto.staffId,
      action: 'assigned',
      shift: assignment.shift,
    });

    this.notificationsGateway.emitToUser(dto.staffId, 'shift-assigned', {
      shift: assignment.shift,
    });

    await this.notificationsService.create(
      dto.staffId,
      'SHIFT_ASSIGNED',
      'Shift Assignment (Override)',
      `You have been assigned to a shift at ${assignment.shift.location.name} via manager override`,
    );

    return assignment;
  }

  private checkIfPremium(startTime: Date): boolean {
    const day = startTime.getDay();
    const hour = startTime.getHours();
    return (day === 5 || day === 6) && hour >= 17;
  }
}
