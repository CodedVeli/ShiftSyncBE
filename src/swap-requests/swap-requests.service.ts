import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { SwapStatus, SwapType, Role } from '@prisma/client';
import { addHours } from 'date-fns';

@Injectable()
export class SwapRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}


  async create(userId: string, dto: CreateSwapRequestDto) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: dto.shiftId },
      include: { assignments: true },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const userAssignment = shift.assignments.find(a => a.staffId === userId);
    if (!userAssignment) {
      throw new BadRequestException('You are not assigned to this shift');
    }

    if (dto.type === SwapType.SWAP && !dto.targetStaffId) {
      throw new BadRequestException('Target staff ID is required for swap requests');
    }

    if (dto.type === SwapType.DROP && dto.targetStaffId) {
      throw new BadRequestException('Target staff ID should not be provided for drop requests');
    }

    const pendingCount = await this.prisma.swapRequest.count({
      where: {
        requesterId: userId,
        status: SwapStatus.PENDING,
      },
    });

    if (pendingCount >= 3) {
      throw new BadRequestException('You have reached the maximum of 3 pending swap requests');
    }

    if (dto.type === SwapType.SWAP && dto.targetStaffId) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: dto.targetStaffId },
      });

      if (!targetUser) {
        throw new NotFoundException('Target staff not found');
      }

      const targetAssignment = shift.assignments.find(a => a.staffId === dto.targetStaffId);
      if (targetAssignment) {
        throw new BadRequestException('Target staff is already assigned to this shift');
      }
    }

    const expiresAt = addHours(new Date(), 48);

    const swapRequest = await this.prisma.swapRequest.create({
      data: {
        shiftId: dto.shiftId,
        requesterId: userId,
        type: dto.type,
        targetStaffId: dto.targetStaffId || null,
        status: SwapStatus.PENDING,
        expiresAt,
      },
      include: {
        shift: {
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
        },
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        targetStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (dto.type === SwapType.SWAP && dto.targetStaffId) {
      await this.notificationsService.create(
        dto.targetStaffId,
        'SWAP_REQUESTED',
        'New Swap Request',
        `${swapRequest.requester.firstName} ${swapRequest.requester.lastName} wants to swap a shift with you`,
      );
    }

    return swapRequest;
  }
  async findAll(userId: string, userRole: Role) {
    if (userRole === Role.STAFF) {
      return this.prisma.swapRequest.findMany({
        where: { OR: [{ requesterId: userId }, { targetStaffId: userId }] },
        include: { shift: { include: { location: true, requiredSkill: true, assignments: { include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } } } } }, requester: { select: { id: true, firstName: true, lastName: true, email: true } }, targetStaff: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.swapRequest.findMany({
      where: {
        status: {
          in: [SwapStatus.PENDING, SwapStatus.TARGET_ACCEPTED],
        },
      },
      include: { shift: { include: { location: true, requiredSkill: true, assignments: { include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } } } } }, requester: { select: { id: true, firstName: true, lastName: true, email: true } }, targetStaff: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(id: string, userId: string) {
    const swapRequest = await this.prisma.swapRequest.findUnique({ where: { id } });

    if (!swapRequest) {
      throw new NotFoundException('Swap request not found');
    }

    if (swapRequest.type === SwapType.SWAP && swapRequest.targetStaffId !== userId) {
      throw new ForbiddenException('Only the target staff can accept this swap request');
    }

    if (swapRequest.type === SwapType.DROP) {
      throw new BadRequestException('Drop requests do not need to be accepted');
    }

    if (swapRequest.status !== SwapStatus.PENDING) {
      throw new BadRequestException(`Cannot accept a swap request with status: ${swapRequest.status}`);
    }

    const updated = await this.prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.TARGET_ACCEPTED, targetAcceptedAt: new Date() },
      include: { shift: { include: { location: true, requiredSkill: true, assignments: { include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } } } } }, requester: { select: { id: true, firstName: true, lastName: true, email: true } }, targetStaff: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await this.notificationsService.create(
      swapRequest.requesterId,
      'SWAP_ACCEPTED',
      'Swap Request Accepted',
      `Your swap request has been accepted. Awaiting manager approval.`,
    );

    return updated;
  }

  async approve(id: string, managerId: string) {
    const swapRequest = await this.prisma.swapRequest.findUnique({
      where: { id },
      include: { shift: true },
    });

    if (!swapRequest) {
      throw new NotFoundException('Swap request not found');
    }

    const manager = await this.prisma.user.findUnique({ where: { id: managerId } });

    if (!manager || (manager.role !== Role.ADMIN && manager.role !== Role.MANAGER)) {
      throw new ForbiddenException('Only managers and admins can approve swap requests');
    }

    if (manager.role === Role.MANAGER) {
      const managerLocation = await this.prisma.managerLocation.findFirst({
        where: { userId: managerId, locationId: swapRequest.shift.locationId },
      });

      if (!managerLocation) {
        throw new ForbiddenException('You do not manage this location');
      }
    }

    const expectedStatus = swapRequest.type === SwapType.SWAP ? SwapStatus.TARGET_ACCEPTED : SwapStatus.PENDING;
    if (swapRequest.status !== expectedStatus) {
      throw new BadRequestException(`Swap request must be in ${expectedStatus} status to approve`);
    }

    return this.prisma.$transaction(async (tx) => {
      const requesterAssignment = await tx.shiftAssignment.findUnique({
        where: {
          shiftId_staffId: {
            shiftId: swapRequest.shiftId,
            staffId: swapRequest.requesterId,
          },
        },
      });

      if (!requesterAssignment) {
        throw new BadRequestException('Requester is no longer assigned to this shift');
      }

      await tx.shiftAssignment.delete({ where: { id: requesterAssignment.id } });

      if (swapRequest.type === SwapType.SWAP && swapRequest.targetStaffId) {
        await tx.shiftAssignment.create({
          data: {
            shiftId: swapRequest.shiftId,
            staffId: swapRequest.targetStaffId,
            assignedBy: managerId,
          },
        });
      }

      const approved = await tx.swapRequest.update({
        where: { id },
        data: {
          status: SwapStatus.MANAGER_APPROVED,
          managerApprovedAt: new Date(),
          managerApprovedBy: managerId,
        },
        include: { shift: { include: { location: true, requiredSkill: true, assignments: { include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } } } } }, requester: { select: { id: true, firstName: true, lastName: true, email: true } }, targetStaff: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });

      await this.notificationsService.create(
        swapRequest.requesterId,
        'SWAP_APPROVED',
        'Swap Request Approved',
        `Your swap request has been approved by the manager.`,
      );

      if (swapRequest.type === SwapType.SWAP && swapRequest.targetStaffId) {
        await this.notificationsService.create(
          swapRequest.targetStaffId,
          'SWAP_APPROVED',
          'Swap Request Approved',
          `The swap request has been approved by the manager.`,
        );
      }

      return approved;
    }, { timeout: 15000 });
  }

  async cancel(id: string, userId: string) {
    const swapRequest = await this.prisma.swapRequest.findUnique({ where: { id } });

    if (!swapRequest) {
      throw new NotFoundException('Swap request not found');
    }

    if (swapRequest.requesterId !== userId) {
      throw new ForbiddenException('Only the requester can cancel this swap request');
    }

    if (swapRequest.status === SwapStatus.CANCELLED) {
      throw new BadRequestException('This swap request is already cancelled');
    }

    if (swapRequest.status === SwapStatus.MANAGER_APPROVED) {
      throw new BadRequestException('Cannot cancel an already approved swap request');
    }

    const updated = await this.prisma.swapRequest.update({
      where: { id },
      data: { status: SwapStatus.CANCELLED, cancelledAt: new Date() },
      include: { shift: { include: { location: true, requiredSkill: true, assignments: { include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } } } } }, requester: { select: { id: true, firstName: true, lastName: true, email: true } }, targetStaff: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    if (swapRequest.type === SwapType.SWAP && swapRequest.targetStaffId) {
      await this.notificationsService.create(
        swapRequest.targetStaffId,
        'SWAP_CANCELLED',
        'Swap Request Cancelled',
        `${updated.requester.firstName} ${updated.requester.lastName} has cancelled the swap request`,
      );
    }

    return updated;
  }
}
