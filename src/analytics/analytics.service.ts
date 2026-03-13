import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfWeek, endOfWeek, differenceInHours } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOvertimeAnalytics(locationId?: string, weekStart?: Date) {
    const start = weekStart ? startOfWeek(weekStart, { weekStartsOn: 0 }) : startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = endOfWeek(start, { weekStartsOn: 0 });

    const shifts = await this.prisma.shift.findMany({
      where: {
        ...(locationId && { locationId }),
        startTime: { gte: start },
        endTime: { lte: end },
      },
      include: {
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

    const staffHoursMap = new Map<string, { staff: any; totalHours: number; overtimeHours: number; shifts: any[] }>();

    shifts.forEach((shift) => {
      shift.assignments.forEach((assignment) => {
        const hours = differenceInHours(new Date(shift.endTime), new Date(shift.startTime));
        const key = assignment.staffId;

        if (!staffHoursMap.has(key)) {
          staffHoursMap.set(key, {
            staff: assignment.staff,
            totalHours: 0,
            overtimeHours: 0,
            shifts: [],
          });
        }

        const entry = staffHoursMap.get(key)!;
        entry.totalHours += hours;
        entry.shifts.push({ id: shift.id, startTime: shift.startTime, endTime: shift.endTime, hours });
      });
    });

    const overtimeData = Array.from(staffHoursMap.values()).map((entry) => ({
      ...entry,
      overtimeHours: entry.totalHours > 40 ? entry.totalHours - 40 : 0,
      isApproachingLimit: entry.totalHours >= 35,
      isOvertime: entry.totalHours > 40,
    }));

    const totalOvertimeHours = overtimeData.reduce((sum, d) => sum + d.overtimeHours, 0);
    const staffWithOvertime = overtimeData.filter((d) => d.isOvertime).length;

    return {
      weekStart: start,
      weekEnd: end,
      totalOvertimeHours,
      staffWithOvertime,
      staffData: overtimeData.sort((a, b) => b.totalHours - a.totalHours),
    };
  }

  async getFairnessAnalytics(locationId?: string, startDate?: Date, endDate?: Date) {
    const start = startDate || startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = endDate || endOfWeek(new Date(), { weekStartsOn: 0 });

    const shifts = await this.prisma.shift.findMany({
      where: {
        ...(locationId && { locationId }),
        startTime: { gte: start },
        endTime: { lte: end },
      },
      include: {
        assignments: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                staffProfile: {
                  select: {
                    desiredWeeklyHours: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const staffDataMap = new Map<string, {
      staff: any;
      totalHours: number;
      totalShifts: number;
      premiumShifts: number;
      desiredHours: number;
    }>();

    shifts.forEach((shift) => {
      shift.assignments.forEach((assignment) => {
        const hours = differenceInHours(new Date(shift.endTime), new Date(shift.startTime));
        const key = assignment.staffId;

        if (!staffDataMap.has(key)) {
          staffDataMap.set(key, {
            staff: assignment.staff,
            totalHours: 0,
            totalShifts: 0,
            premiumShifts: 0,
            desiredHours: assignment.staff.staffProfile?.desiredWeeklyHours || 40,
          });
        }

        const entry = staffDataMap.get(key)!;
        entry.totalHours += hours;
        entry.totalShifts += 1;
        if (shift.isPremium) entry.premiumShifts += 1;
      });
    });

    const staffData = Array.from(staffDataMap.values());
    const avgPremiumShifts = staffData.reduce((sum, d) => sum + d.premiumShifts, 0) / (staffData.length || 1);

    const fairnessData = staffData.map((entry) => ({
      ...entry,
      hoursVariance: entry.totalHours - entry.desiredHours,
      premiumShiftVariance: entry.premiumShifts - avgPremiumShifts,
    }));

    return {
      startDate: start,
      endDate: end,
      averagePremiumShifts: avgPremiumShifts,
      staffData: fairnessData.sort((a, b) => b.totalHours - a.totalHours),
    };
  }

  async getHoursDistribution(locationId?: string, startDate?: Date, endDate?: Date) {
    const start = startDate || startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = endDate || endOfWeek(new Date(), { weekStartsOn: 0 });

    const shifts = await this.prisma.shift.findMany({
      where: {
        ...(locationId && { locationId }),
        startTime: { gte: start },
        endTime: { lte: end },
      },
      include: {
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

    const staffHoursMap = new Map<string, { staff: any; hours: number }>();

    shifts.forEach((shift) => {
      shift.assignments.forEach((assignment) => {
        const hours = differenceInHours(new Date(shift.endTime), new Date(shift.startTime));
        const key = assignment.staffId;

        if (!staffHoursMap.has(key)) {
          staffHoursMap.set(key, { staff: assignment.staff, hours: 0 });
        }

        staffHoursMap.get(key)!.hours += hours;
      });
    });

    return {
      startDate: start,
      endDate: end,
      distribution: Array.from(staffHoursMap.values()).sort((a, b) => b.hours - a.hours),
    };
  }
}
