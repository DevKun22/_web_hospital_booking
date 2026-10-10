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
not equal `DATABASE_URL`.

Some managed providers, including Prisma Postgres, always expose `/postgres`
in the URL even for a separately named test project. After verifying the URL
belongs to a dedicated test project, add this explicit acknowledgement:

```env
TEST_DATABASE_DESTRUCTIVE_OK=I_UNDERSTAND_TEST_DATA_WILL_BE_DELETED
```

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
```

## Runtime checks

Run the read-only preflight report against the intended deployment database
before rollout:

```bash
npm run audit:phase0
```

Production must run both `worker:otp` and `worker:appointments` with a valid
`REDIS_URL`. The appointment worker owns delayed expiry jobs and periodic
reconciliation; the dashboard cleanup endpoint remains an operational fallback.
