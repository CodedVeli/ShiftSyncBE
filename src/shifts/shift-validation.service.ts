import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { differenceInHours, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from 'date-fns';

interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  suggestions?: Array<{ staffId: string; staffName: string; reason: string }>;
}

@Injectable()
export class ShiftValidationService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
  ) {}

  async validateAssignment(shiftId: string, staffId: string): Promise<ValidationResult> {
    const warnings: string[] = [];

    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { location: true, requiredSkill: true },
    });

    if (!shift) return { valid: false, error: 'Shift not found' };

    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: {
        staffProfile: {
          include: { skills: true, certifiedLocations: true },
        },
      },
    });

    if (!staff) return { valid: false, error: 'Staff member not found' };

    const isCertified = staff?.staffProfile?.certifiedLocations.some(
      (loc) => loc.id === shift.locationId
    );

    const activeCertification = await this.prisma.locationCertification.findFirst({
      where: {
        staffProfileId: staff.staffProfile.id,
        locationId: shift.locationId,
        decertifiedAt: null,
      },
    });

    if (!isCertified && !activeCertification) {
      const staffName = staff.firstName + ' ' + staff.lastName;
      const locationName = shift.location.name;
      return {
        valid: false,
        error: staffName + ' is not certified to work at ' + locationName,
        suggestions: await this.generateSuggestions(shift),
      };
    }

    if (isCertified && !activeCertification) {
      const staffName = staff.firstName + ' ' + staff.lastName;
      const locationName = shift.location.name;
      return {
        valid: false,
        error: staffName + ' was de-certified from ' + locationName + '. Historical assignments remain viewable.',
        suggestions: await this.generateSuggestions(shift),
      };
    }

    const hasSkill = staff?.staffProfile?.skills.some(
      (skill) => skill.id === shift.requiredSkillId
    );
    
    if (!hasSkill) {
      const staffName = staff.firstName + ' ' + staff.lastName;
      const skillName = shift.requiredSkill.name;
      return {
        valid: false,
        error: staffName + ' does not have the required skill: ' + skillName,
        suggestions: await this.generateSuggestions(shift),
      };
    }

    const overlapping = await this.prisma.shiftAssignment.findFirst({
      where: {
        staffId,
        shift: {
          OR: [
            { AND: [{ startTime: { lte: shift.startTime } }, { endTime: { gt: shift.startTime } }] },
            { AND: [{ startTime: { lt: shift.endTime } }, { endTime: { gte: shift.endTime } }] },
            { AND: [{ startTime: { gte: shift.startTime } }, { endTime: { lte: shift.endTime } }] },
          ],
        },
      },
      include: { shift: { include: { location: true } } },
    });

    if (overlapping) {
      const staffName = staff.firstName + ' ' + staff.lastName;
      return {
        valid: false,
        error: staffName + ' is already assigned to another shift at that time',
        suggestions: await this.generateSuggestions(shift),
      };
    }

    const previousShift = await this.prisma.shiftAssignment.findFirst({
      where: { staffId, shift: { endTime: { lte: shift.startTime } } },
      orderBy: { shift: { endTime: 'desc' } },
      include: { shift: true },
    });

    if (previousShift) {
      const restHours = differenceInHours(new Date(shift.startTime), new Date(previousShift.shift.endTime));
      if (restHours < 10) {
        const staffName = staff.firstName + ' ' + staff.lastName;
        return {
          valid: false,
          error: staffName + ' would have only ' + restHours + ' hours rest (minimum 10 hours required)',
          suggestions: await this.generateSuggestions(shift),
        };
      }
    }

    const weekStart = startOfWeek(new Date(shift.startTime), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(new Date(shift.startTime), { weekStartsOn: 0 });
    
    const weekShifts = await this.prisma.shiftAssignment.findMany({
      where: { staffId, shift: { startTime: { gte: weekStart }, endTime: { lte: weekEnd } } },
      include: { shift: true },
    });

    let totalHours = differenceInHours(new Date(shift.endTime), new Date(shift.startTime));
    weekShifts.forEach((a) => {
      totalHours += differenceInHours(new Date(a.shift.endTime), new Date(a.shift.startTime));
    });

    const staffName = staff.firstName + ' ' + staff.lastName;
    if (totalHours > 40) {
      const overtimeHours = totalHours - 40;
      warnings.push(staffName + ' will work ' + totalHours + ' hours (' + overtimeHours + 'h overtime)');
    } else if (totalHours >= 35) {
      warnings.push(staffName + ' will work ' + totalHours + ' hours this week');
    }

    const availabilityCheck = await this.checkAvailability(shift, staffId);
    if (!availabilityCheck.valid) {
      return { ...availabilityCheck, suggestions: await this.generateSuggestions(shift) };
    }

    const consecutiveDaysCheck = await this.checkConsecutiveDays(shift, staffId);
    if (!consecutiveDaysCheck.valid) {
      return { ...consecutiveDaysCheck, suggestions: await this.generateSuggestions(shift) };
    }
    if (consecutiveDaysCheck.warnings) {
      warnings.push(...consecutiveDaysCheck.warnings);
    }

    return { valid: true, warnings };
  }

  private async checkAvailability(shift: any, staffId: string): Promise<ValidationResult> {
    const isAvailable = await this.availabilityService.checkAvailability(
      staffId,
      new Date(shift.startTime),
      new Date(shift.endTime),
      shift.location.timezone
    );

    if (!isAvailable) {
      const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
      const staffName = staff.firstName + ' ' + staff.lastName;
      return {
        valid: false,
        error: staffName + ' is not available during this shift time based on their availability settings',
      };
    }

    return { valid: true };
  }

  private async checkConsecutiveDays(shift: any, staffId: string): Promise<ValidationResult> {
    const shiftDate = startOfDay(new Date(shift.startTime));
    let consecutiveDays = 1;
    let checkDate = addDays(shiftDate, -1);

    for (let i = 0; i < 7; i++) {
      const dayStart = startOfDay(checkDate);
      const dayEnd = endOfDay(checkDate);

      const hasShift = await this.prisma.shiftAssignment.findFirst({
        where: {
          staffId,
          shift: {
            startTime: { gte: dayStart },
            endTime: { lte: dayEnd },
          },
        },
      });

      if (hasShift) {
        consecutiveDays++;
        checkDate = addDays(checkDate, -1);
      } else {
        break;
      }
    }

    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    const staffName = staff.firstName + ' ' + staff.lastName;

    if (consecutiveDays >= 7) {
      return {
        valid: false,
        error: staffName + ' would work their 7th consecutive day. This requires manager override with documented reason.',
      };
    }

    if (consecutiveDays >= 6) {
      return {
        valid: true,
        warnings: [staffName + ' will work their 6th consecutive day'],
      };
    }

    return { valid: true };
  }

  private async generateSuggestions(shift: any): Promise<any[]> {
    const qualifiedStaff = await this.prisma.user.findMany({
      where: {
        staffProfile: {
          skills: { some: { id: shift.requiredSkillId } },
          certifiedLocations: { some: { id: shift.locationId } },
        },
      },
    });

    const suggestions = [];

    for (const staff of qualifiedStaff) {
      const isValid = await this.quickValidateStaff(shift, staff.id);

      if (isValid) {
        suggestions.push({
          staffId: staff.id,
          staffName: staff.firstName + ' ' + staff.lastName,
          reason: 'Available and qualified',
        });
      }

      if (suggestions.length >= 5) break;
    }

    return suggestions;
  }

  private async quickValidateStaff(shift: any, staffId: string): Promise<boolean> {
    const overlapping = await this.prisma.shiftAssignment.findFirst({
      where: {
        staffId,
        shift: {
          OR: [
            { AND: [{ startTime: { lte: shift.startTime } }, { endTime: { gt: shift.startTime } }] },
            { AND: [{ startTime: { lt: shift.endTime } }, { endTime: { gte: shift.endTime } }] },
            { AND: [{ startTime: { gte: shift.startTime } }, { endTime: { lte: shift.endTime } }] },
          ],
        },
      },
    });

    if (overlapping) return false;

    const previousShift = await this.prisma.shiftAssignment.findFirst({
      where: { staffId, shift: { endTime: { lte: shift.startTime } } },
      orderBy: { shift: { endTime: 'desc' } },
      include: { shift: true },
    });

    if (previousShift) {
      const restHours = differenceInHours(new Date(shift.startTime), new Date(previousShift.shift.endTime));
      if (restHours < 10) return false;
    }

    const availabilityCheck = await this.checkAvailability(shift, staffId);
    if (!availabilityCheck.valid) return false;

    const weekStart = startOfWeek(new Date(shift.startTime), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(new Date(shift.startTime), { weekStartsOn: 0 });

    const weekShifts = await this.prisma.shiftAssignment.findMany({
      where: { staffId, shift: { startTime: { gte: weekStart }, endTime: { lte: weekEnd } } },
      include: { shift: true },
    });

    let totalHours = differenceInHours(new Date(shift.endTime), new Date(shift.startTime));
    weekShifts.forEach((a) => {
      totalHours += differenceInHours(new Date(a.shift.endTime), new Date(a.shift.startTime));
    });

    if (totalHours > 40) return false;

    return true;
  }
}
