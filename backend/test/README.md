# Backend Phase 0 tests

## Fast checks

These tests do not connect to PostgreSQL:

```bash
npm test
npm run test:types
```

## Integration baseline

Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database or schema. Its
database name (or `schema` query parameter) must contain `test`, and it must
not equal `DATABASE_URL`. The test runner has no override for an unmarked
database. For Prisma Postgres URLs ending in `/postgres`, add an isolated
schema such as `?schema=hospital_booking_test` (or `&schema=...` when the URL
already has query parameters).

```bash
npm run test:integration
```

The integration runner applies committed Prisma migrations, truncates test
fixtures between cases, and verifies the booking, OTP, dashboard session,
doctor ownership, lookup grant, atomic appointment transitions, pending-booking
expiry, patient canonical-data protection, invoice, payment idempotency, and
legacy response contracts. Never point `TEST_DATABASE_URL` at development or
production data.

Run all Phase 0 checks with:

```bash
npm run test:phase0

# Phase 0 + Phase 1 quality gate (recommended for the current branch)
npm run test:phase1

# One complete patient-care journey on TEST_DATABASE_URL
npm run test:e2e
```

## Runtime checks

Run the read-only preflight report against the intended deployment database
before rollout:

```bash
npm run audit:phase0
```

Production must run `worker:otp`, `worker:appointments` and
`worker:notifications`. The OTP and appointment workers require a valid
`QUEUE_REDIS_URL` (or legacy `REDIS_URL`). The notification worker reads pending
deliveries from PostgreSQL and requires one Firebase Admin credential method.
The appointment worker owns delayed expiry jobs and periodic reconciliation;
the dashboard cleanup endpoint remains an operational fallback.
