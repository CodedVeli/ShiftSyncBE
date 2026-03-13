# ShiftSync Backend

Multi-location staff scheduling system with constraint enforcement and real-time updates.

## Tech Stack

- NestJS
- PostgreSQL + Prisma ORM
- Socket.io for real-time updates
- JWT authentication

## Setup

```bash
# Install dependencies
pnpm install

# Set up database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
pnpm prisma:migrate

# Seed database
pnpm prisma:seed

# Start development server
pnpm start:dev
```

## Environment Variables

```
DATABASE_URL="postgresql://user:password@localhost:5432/shiftsync"
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="7d"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

## Test Accounts

After seeding, use these credentials:

- **Admin**: admin@test.com / password
- **Manager (SF)**: manager1@test.com / password
- **Manager (NY)**: manager2@test.com / password
- **Staff**: staff1@test.com / password

## API Endpoints

### Auth
- POST /auth/login
- POST /auth/register
- GET /auth/me

### Shifts
- GET /shifts
- POST /shifts
- PUT /shifts/:id
- DELETE /shifts/:id
- POST /shifts/:id/assign
- DELETE /shifts/:id/assign/:staffId
- POST /shifts/:id/override
- POST /shifts/publish

### Swap Requests
- GET /swap-requests
- POST /swap-requests
- POST /swap-requests/:id/accept
- POST /swap-requests/:id/approve
- POST /swap-requests/:id/cancel

### Analytics
- GET /analytics/overtime
- GET /analytics/fairness
- GET /analytics/hours-distribution

### Notifications
- GET /notifications/me
- GET /notifications/unread-count
- PUT /notifications/:id/read
- PUT /notifications/read-all

### Audit
- GET /audit (Admin/Manager only)
- GET /audit/shift/:id

## Constraint Validation Rules

1. Staff exists
2. Shift exists
3. Location certification
4. Required skill match
5. Availability window
6. No double-booking
7. 10-hour rest period
8. Daily hours (8h warn, 12h block)
9. Weekly hours (35h warn, 40h overtime)
10. Consecutive days (6th warn, 7th require override)

## WebSocket Events

Server emits:
- `schedule-updated` - Shift created/updated/deleted
- `assignment-changed` - Staff assigned/unassigned
- `shift-assigned` - Personal notification
- `shift-unassigned` - Personal notification
- `notification-received` - New notification

## Architecture Decisions

### Ambiguity Resolutions

**1. Historical Data When Staff De-Certified**
- Keep all historical assignments intact
- Add `decertifiedAt` timestamp to StaffLocation
- Past shifts remain viewable in audit logs
- Block future assignments to that location
- Rationale: Preserves audit trail, prevents data loss

**2. Desired Hours vs Availability Windows**
- Desired hours = soft target for managers (informational only)
- Availability windows = hard constraints (enforced during assignment)
- Analytics show actual vs desired hours for tracking
- Rationale: Availability prevents bad assignments, desired hours guide fair distribution

**3. Consecutive Days - Partial Shifts**
- Any shift counts as 1 worked day, regardless of duration
- 1-hour shift = 11-hour shift for consecutive day tracking
- 6th consecutive day triggers warning, 7th requires override
- Rationale: Simplicity and consistency, prevents gaming the system

**4. Shift Edited After Swap Approval**
- Auto-cancel swap if shift time/location/skill changes after approval
- Notify requester, target, and manager of cancellation
- Manager must re-review and re-approve if swap still needed
- Rationale: Prevents confusion, ensures all parties agree to actual shift details

**5. Timezone Boundary Locations**
- Each location has exactly one timezone
- If location straddles boundary, use main entrance timezone
- All shifts at that location use the same timezone
- Rationale: Avoids complexity, clear expectation for staff

### Technical Decisions

**Timezone Handling**: Store all times in UTC, convert to location timezone for validation and display.

**Concurrent Operations**: Use Prisma transactions with optimistic locking (version field) to prevent double-assignment.

**Overnight Shifts**: If endTime < startTime, treat as next day shift.

**Swap Workflow**: Staff A requests → Staff B accepts → Manager approves (both steps required).

**Premium Shifts**: Friday/Saturday after 5pm automatically tagged for fairness tracking.

## Deployment

1. Set up PostgreSQL database
2. Set environment variables
3. Run migrations: `pnpm prisma:migrate:deploy`
4. Run seed: `pnpm prisma:seed`
5. Build: `pnpm build`
6. Start: `pnpm start:prod`

## Known Limitations

- No mobile app (responsive web only)
- Timezone changes (DST) require manual verification
- Notification system is push-only (no email/SMS)
