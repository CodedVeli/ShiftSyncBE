import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { addDays, startOfWeek, setHours, setMinutes } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  console.log('Cleaning database...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.managerLocation.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.location.deleteMany();
  console.log('Database cleaned');

  const hashedPassword = await bcrypt.hash('password', 10);
  
  const locations = await Promise.all([
    prisma.location.create({ data: { name: 'Downtown SF', address: '123 Market St, San Francisco, CA', timezone: 'America/Los_Angeles' } }),
    prisma.location.create({ data: { name: 'Union Square SF', address: '456 Powell St, San Francisco, CA', timezone: 'America/Los_Angeles' } }),
    prisma.location.create({ data: { name: 'Brooklyn Heights', address: '789 Atlantic Ave, Brooklyn, NY', timezone: 'America/New_York' } }),
    prisma.location.create({ data: { name: 'Manhattan Midtown', address: '321 5th Ave, New York, NY', timezone: 'America/New_York' } }),
  ]);
  
  const skills = await Promise.all([
    prisma.skill.create({ data: { name: 'bartender' } }),
    prisma.skill.create({ data: { name: 'line cook' } }),
    prisma.skill.create({ data: { name: 'server' } }),
    prisma.skill.create({ data: { name: 'host' } }),
  ]);
  
  const admin = await prisma.user.create({ data: { email: 'admin@test.com', password: hashedPassword, firstName: 'Admin', lastName: 'User', role: 'ADMIN' } });
  const manager1 = await prisma.user.create({ data: { email: 'manager1@test.com', password: hashedPassword, firstName: 'Sarah', lastName: 'Johnson', role: 'MANAGER' } });
  const manager2 = await prisma.user.create({ data: { email: 'manager2@test.com', password: hashedPassword, firstName: 'Michael', lastName: 'Chen', role: 'MANAGER' } });
  
  await prisma.managerLocation.createMany({ data: [{ userId: manager1.id, locationId: locations[0].id }, { userId: manager1.id, locationId: locations[1].id }] });
  await prisma.managerLocation.createMany({ data: [{ userId: manager2.id, locationId: locations[2].id }, { userId: manager2.id, locationId: locations[3].id }] });
  
  const staff1 = await prisma.user.create({ data: { email: 'staff1@test.com', password: hashedPassword, firstName: 'Alex', lastName: 'Martinez', role: 'STAFF' } });
  await prisma.staffProfile.create({ data: { userId: staff1.id, desiredWeeklyHours: 40, skills: { connect: [{ id: skills[0].id }, { id: skills[2].id }] }, certifiedLocations: { connect: locations.map((l) => ({ id: l.id })) } } });

  const staffData = [
    { firstName: 'Emma', lastName: 'Wilson', skillIds: [0, 2], locationIds: [0, 1], desiredHours: 35 },
    { firstName: 'James', lastName: 'Brown', skillIds: [1], locationIds: [0, 1], desiredHours: 40 },
    { firstName: 'Olivia', lastName: 'Davis', skillIds: [2], locationIds: [0, 1, 2], desiredHours: 30 },
    { firstName: 'Noah', lastName: 'Miller', skillIds: [0, 2], locationIds: [1], desiredHours: 38 },
    { firstName: 'Ava', lastName: 'Garcia', skillIds: [3], locationIds: [0, 1], desiredHours: 25 },
    { firstName: 'Liam', lastName: 'Rodriguez', skillIds: [1], locationIds: [2, 3], desiredHours: 40 },
    { firstName: 'Sophia', lastName: 'Martinez', skillIds: [2], locationIds: [2, 3], desiredHours: 35 },
    { firstName: 'Mason', lastName: 'Hernandez', skillIds: [0], locationIds: [2, 3], desiredHours: 38 },
    { firstName: 'Isabella', lastName: 'Lopez', skillIds: [2, 3], locationIds: [3], desiredHours: 30 },
    { firstName: 'Ethan', lastName: 'Gonzalez', skillIds: [1], locationIds: [0], desiredHours: 40 },
    { firstName: 'Mia', lastName: 'Wilson', skillIds: [0, 2], locationIds: [1, 2], desiredHours: 35 },
    { firstName: 'Lucas', lastName: 'Anderson', skillIds: [2], locationIds: [0, 1, 2, 3], desiredHours: 40 },
    { firstName: 'Charlotte', lastName: 'Thomas', skillIds: [3], locationIds: [2, 3], desiredHours: 28 },
    { firstName: 'Benjamin', lastName: 'Taylor', skillIds: [1], locationIds: [1], desiredHours: 38 },
    { firstName: 'Amelia', lastName: 'Moore', skillIds: [0], locationIds: [0, 1], desiredHours: 35 },
    { firstName: 'Henry', lastName: 'Jackson', skillIds: [2], locationIds: [2, 3], desiredHours: 40 },
    { firstName: 'Harper', lastName: 'Martin', skillIds: [1, 2], locationIds: [0], desiredHours: 36 },
    { firstName: 'Daniel', lastName: 'Lee', skillIds: [0], locationIds: [3], desiredHours: 38 },
    { firstName: 'Evelyn', lastName: 'Perez', skillIds: [2, 3], locationIds: [1, 2], desiredHours: 32 },
    { firstName: 'Jack', lastName: 'White', skillIds: [1], locationIds: [0, 1], desiredHours: 40 },
  ];

  const staffUsers = [];
  for (const staff of staffData) {
    const user = await prisma.user.create({
      data: { email: `${staff.firstName.toLowerCase()}.${staff.lastName.toLowerCase()}@test.com`, password: hashedPassword, firstName: staff.firstName, lastName: staff.lastName, role: 'STAFF' },
    });
    await prisma.staffProfile.create({
      data: { userId: user.id, desiredWeeklyHours: staff.desiredHours, skills: { connect: staff.skillIds.map((idx) => ({ id: skills[idx].id })) }, certifiedLocations: { connect: staff.locationIds.map((idx) => ({ id: locations[idx].id })) } },
    });
    staffUsers.push(user);
  }

  console.log(`Created ${staffUsers.length + 1} staff users`);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const allStaff = [staff1, ...staffUsers];
  const shifts = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDay = addDays(weekStart, dayOffset);
    for (const location of locations) {
      const morningShift = await prisma.shift.create({
        data: { locationId: location.id, startTime: setMinutes(setHours(currentDay, 6), 0), endTime: setMinutes(setHours(currentDay, 14), 0), requiredSkillId: skills[1].id, headcountNeeded: 2, isPublished: true, createdById: admin.id },
      });
      shifts.push(morningShift);

      const lunchShift = await prisma.shift.create({
        data: { locationId: location.id, startTime: setMinutes(setHours(currentDay, 11), 0), endTime: setMinutes(setHours(currentDay, 16), 0), requiredSkillId: skills[2].id, headcountNeeded: 3, isPublished: true, createdById: admin.id },
      });
      shifts.push(lunchShift);

      const isPremium = currentDay.getDay() === 5 || currentDay.getDay() === 6;
      const eveningShift = await prisma.shift.create({
        data: { locationId: location.id, startTime: setMinutes(setHours(currentDay, 17), 0), endTime: setMinutes(setHours(currentDay, 23), 0), requiredSkillId: skills[0].id, headcountNeeded: 2, isPublished: true, isPremium, createdById: admin.id },
      });
      shifts.push(eveningShift);

      if (dayOffset === 5 || dayOffset === 6) {
        const lateShift = await prisma.shift.create({
          data: { locationId: location.id, startTime: setMinutes(setHours(currentDay, 23), 0), endTime: setMinutes(setHours(addDays(currentDay, 1), 3), 0), requiredSkillId: skills[2].id, headcountNeeded: 1, isPublished: true, isPremium: true, createdById: admin.id },
        });
        shifts.push(lateShift);
      }
    }
  }

  console.log(`Created ${shifts.length} shifts`);

  let assignmentCount = 0;
  const staffHours = {};

  for (const shift of shifts) {
    const profiles = await prisma.staffProfile.findMany({
      where: { skills: { some: { id: shift.requiredSkillId } }, certifiedLocations: { some: { id: shift.locationId } } },
      include: { user: true },
      take: shift.headcountNeeded,
    });

    for (const p of profiles) {
      if (!staffHours[p.userId]) staffHours[p.userId] = 0;
      const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);

      if (staffHours[p.userId] < 42) {
        await prisma.shiftAssignment.create({
          data: { shiftId: shift.id, staffId: p.userId, assignedBy: admin.id },
        });
        staffHours[p.userId] += shiftDuration;
        assignmentCount++;
      }
    }
  }

  console.log(`Created ${assignmentCount} shift assignments`);

  const swapShift = shifts.find((s) => s.isPremium);
  if (swapShift) {
    const assignment = await prisma.shiftAssignment.findFirst({ where: { shiftId: swapShift.id } });
    if (assignment) {
      const targetStaff = allStaff.find((s) => s.id !== assignment.staffId);
      if (targetStaff) {
        await prisma.swapRequest.create({
          data: { shiftId: swapShift.id, requesterId: assignment.staffId, type: 'SWAP', targetStaffId: targetStaff.id, status: 'PENDING', expiresAt: addDays(new Date(), 7) },
        });
      }
    }
  }

  const dropShift = shifts.find((s) => !s.isPremium);
  if (dropShift) {
    const assignment = await prisma.shiftAssignment.findFirst({ where: { shiftId: dropShift.id } });
    if (assignment) {
      await prisma.swapRequest.create({
        data: { shiftId: dropShift.id, requesterId: assignment.staffId, type: 'DROP', status: 'PENDING', expiresAt: addDays(new Date(), 1) },
      });
    }
  }

  console.log('Created 2 swap requests');

  for (const staffUser of allStaff.slice(0, 10)) {
    const profile = await prisma.staffProfile.findUnique({ where: { userId: staffUser.id } });
    if (profile) {
      await prisma.availability.createMany({
        data: [
          { staffProfileId: profile.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isException: false, isAvailable: true },
          { staffProfileId: profile.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isException: false, isAvailable: true },
          { staffProfileId: profile.id, dayOfWeek: 5, startTime: '17:00', endTime: '23:00', isException: false, isAvailable: true },
        ],
      });
    }
  }

  console.log('Created availability patterns');
  console.log('Seed completed successfully!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
