import "dotenv/config";

import crypto from "node:crypto";
import { Redis } from "ioredis";

import { prisma } from "../config/prisma.js";
import { getRedisConnectionOptions } from "../queues/redis.js";
import AuthSessionService from "../services/authSession.service.js";
import { generateDashboardAccessToken } from "../utils/jwt.js";

type JsonRecord = Record<string, unknown>;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type StepResult = {
  name: string;
  durationMs: number;
  detail?: string;
};

const apiBaseUrl = (process.env.ACCEPTANCE_API_URL || "http://backend-api:4000/api")
  .replace(/\/$/, "");
const allowWrite = process.env.ACCEPTANCE_ALLOW_WRITE === "true";

if (!allowWrite) {
  throw new Error(
    "Remote acceptance writes temporary demo records. Set ACCEPTANCE_ALLOW_WRITE=true to acknowledge the controlled write flow.",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Remote acceptance is disabled when NODE_ENV=production.");
}

const databaseUrl = process.env.DATABASE_URL || "";
const databaseMarker = (() => {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.pathname} ${parsed.searchParams.get("schema") || ""}`.toLowerCase();
  } catch {
    return "";
  }
})();

if (!databaseUrl || databaseMarker.includes("test")) {
  throw new Error(
    "Remote acceptance requires the configured demo DATABASE_URL and refuses test databases/schemas.",
  );
}

const steps: StepResult[] = [];
const created: {
  phone?: string;
  slotId?: string;
  appointmentId?: string;
  patientId?: string;
  dashboardSessionId?: string;
} = {};

const timed = async <T>(name: string, action: () => Promise<T>, detail?: (value: T) => string) => {
  const startedAt = performance.now();
  const value = await action();
  steps.push({
    name,
    durationMs: Number((performance.now() - startedAt).toFixed(1)),
    detail: detail?.(value),
  });
  return value;
};

const api = async <T>(
  path: string,
  init: RequestInit = {},
  expectedStatus = 200,
) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (response.status !== expectedStatus || !payload || payload.success === false) {
    throw new Error(
      `${init.method || "GET"} ${path} returned ${response.status}: ${payload?.message || "invalid JSON response"}`,
    );
  }
  return payload.data as T;
};

const waitFor = async <T>(
  action: () => Promise<T | null>,
  timeoutMs = 15_000,
  intervalMs = 300,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await action();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms while waiting for acceptance state.`);
};

const allocatePhone = async () => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = crypto.randomInt(0, 100_000_000).toString().padStart(8, "0");
    const phone = `09${suffix}`;
    const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!exists) return phone;
  }
  throw new Error("Could not allocate an isolated acceptance phone number.");
};

const cleanup = async () => {
  const cleanupErrors: string[] = [];
  const safely = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (created.appointmentId) {
    await safely("appointment", () =>
      prisma.appointment.deleteMany({ where: { id: created.appointmentId } }),
    );
  }
  if (created.slotId) {
    await safely("slot", () =>
      prisma.doctorTimeSlot.deleteMany({ where: { id: created.slotId } }),
    );
  }
  if (created.phone) {
    await safely("otp-attempts", () =>
      prisma.otpVerifyAttempt.deleteMany({ where: { phone: created.phone } }),
    );
    await safely("otp-codes", () =>
      prisma.otpCode.deleteMany({ where: { phone: created.phone } }),
    );
    await safely("otp-blocks", () =>
      prisma.otpSecurityBlock.deleteMany({ where: { target: created.phone } }),
    );
  }
  if (created.patientId) {
    await safely("patient", () =>
      prisma.user.deleteMany({ where: { id: created.patientId } }),
    );
  }
  if (created.dashboardSessionId) {
    await safely("dashboard-session", () =>
      prisma.dashboardSession.deleteMany({ where: { id: created.dashboardSessionId } }),
    );
  }

  if (cleanupErrors.length) {
    throw new Error(`Acceptance cleanup was incomplete: ${cleanupErrors.join(" | ")}`);
  }
};

let failure: unknown;

try {
  const health = await timed(
    "backend-health",
    async () => {
      const response = await fetch(new URL("/health", apiBaseUrl).toString());
      if (!response.ok) throw new Error(`Health returned ${response.status}`);
      return (await response.json()) as JsonRecord;
    },
    () => "healthy",
  );
  if (health.status !== "ok") throw new Error("Backend health payload is not ok.");

  await timed(
    "redis-queue",
    async () => {
      const redis = new Redis({
        ...getRedisConnectionOptions(),
        lazyConnect: true,
        connectTimeout: 5_000,
      });
      try {
        await redis.connect();
        if ((await redis.ping()) !== "PONG") throw new Error("Redis did not return PONG.");
        const memory = await redis.info("memory");
        if (!memory.includes("maxmemory_policy:noeviction")) {
          throw new Error("Queue Redis must use maxmemory-policy=noeviction.");
        }
      } finally {
        await redis.quit().catch(() => redis.disconnect());
      }
    },
    () => "PONG · noeviction",
  );

  const bootstrap = await timed(
    "public-bootstrap",
    () =>
      api<{
        departments: unknown[];
        doctors: unknown[];
        packages: unknown[];
      }>("/public/bootstrap?view=full"),
    (value) =>
      `departments=${value.departments.length}, doctors=${value.doctors.length}, packages=${value.packages.length}`,
  );
  if (!bootstrap.departments.length || !bootstrap.doctors.length) {
    throw new Error("The remote demo database has no department/doctor catalog data.");
  }

  const [doctor, admin] = await Promise.all([
    prisma.doctorProfile.findFirst({
      where: { isAvailable: true, user: { isActive: true } },
      select: { id: true, departmentId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
      select: { id: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!doctor) throw new Error("No available doctor exists in the remote demo database.");
  if (!admin || (admin.role !== "ADMIN" && admin.role !== "STAFF")) {
    throw new Error("No active ADMIN/STAFF account exists for dashboard acceptance.");
  }

  created.phone = await allocatePhone();
  const appointmentDate = new Date();
  appointmentDate.setUTCDate(appointmentDate.getUTCDate() + 30);
  appointmentDate.setUTCHours(0, 0, 0, 0);
  const minuteSeed = crypto.randomInt(0, 120);
  const startMinutes = 18 * 60 + minuteSeed;
  const endMinutes = startMinutes + 20;
  const formatMinutes = (value: number) =>
    `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;

  const slot = await timed("temporary-slot", () =>
    prisma.doctorTimeSlot.create({
      data: {
        doctorId: doctor.id,
        date: appointmentDate,
        startTime: formatMinutes(startMinutes),
        endTime: formatMinutes(endMinutes),
      },
      select: { id: true },
    }),
  );
  created.slotId = slot.id;

  const booking = await timed(
    "booking-create",
    () =>
      api<{
        appointmentId: string;
        debugOtp?: string;
        status: string;
      }>(
        "/v1/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            departmentId: doctor.departmentId,
            doctorId: doctor.id,
            timeSlotId: slot.id,
            patientName: "Nghiệm thu Docker tự động",
            patientPhone: created.phone,
            otpChannel: "SMS",
            reason: "Dữ liệu tạm của quy trình nghiệm thu Docker remote-db",
          }),
        },
        201,
      ),
    (value) => value.status,
  );
  created.appointmentId = booking.appointmentId;
  if (!booking.debugOtp) {
    throw new Error("OTP_DEBUG_ENABLED did not expose the temporary acceptance OTP.");
  }

  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.appointmentId },
    select: { patientId: true },
  });
  created.patientId = appointment.patientId;

  await timed(
    "otp-worker-delivery",
    () =>
      waitFor(async () => {
        const otp = await prisma.otpCode.findFirst({
          where: { phone: created.phone, purpose: "BOOK_APPOINTMENT" },
          orderBy: { createdAt: "desc" },
          select: { deliveryStatus: true },
        });
        return otp?.deliveryStatus === "SENT" ? otp.deliveryStatus : null;
      }),
    (value) => value,
  );

  const verified = await timed(
    "booking-verify-otp",
    () =>
      api<{ status: string }>(`/v1/appointments/${booking.appointmentId}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ otp: booking.debugOtp }),
      }),
    (value) => value.status,
  );
  if (verified.status !== "PENDING_CONFIRM") {
    throw new Error(`Unexpected verified status: ${verified.status}`);
  }

  const authSession = await AuthSessionService.create({
    userId: admin.id,
    kind: "DASHBOARD",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    meta: { deviceName: "Docker remote acceptance", platform: "automation" },
  });
  created.dashboardSessionId = authSession.session.id;
  const dashboardToken = generateDashboardAccessToken(
    { userId: admin.id, role: admin.role, sessionId: authSession.session.id },
    "15m",
  );
  const dashboardHeaders = {
    cookie: `dashboard_token=${dashboardToken}`,
    "x-hospital-dashboard-request": "1",
  };

  const confirmed = await timed(
    "dashboard-confirm",
    () =>
      api<{ status: string }>(`/dashboard/appointments/${booking.appointmentId}/confirm`, {
        method: "PATCH",
        headers: dashboardHeaders,
      }),
    (value) => value.status,
  );
  if (confirmed.status !== "CONFIRMED") {
    throw new Error(`Unexpected confirmation status: ${confirmed.status}`);
  }

  await timed(
    "confirmation-notification",
    () =>
      waitFor(async () => {
        const count = await prisma.notification.count({
          where: {
            userId: created.patientId,
            entityId: booking.appointmentId,
            type: "APPOINTMENT_CONFIRMED",
          },
        });
        return count === 1 ? count : null;
      }),
    () => "created once",
  );

  const cancelled = await timed(
    "dashboard-cancel",
    () =>
      api<{ status: string }>(`/dashboard/appointments/${booking.appointmentId}/cancel`, {
        method: "PATCH",
        headers: dashboardHeaders,
        body: JSON.stringify({ reason: "Hoàn tất nghiệm thu Docker tự động" }),
      }),
    (value) => value.status,
  );
  if (cancelled.status !== "CANCELLED_BY_ADMIN") {
    throw new Error(`Unexpected cancellation status: ${cancelled.status}`);
  }

  await timed(
    "cancellation-notification",
    () =>
      waitFor(async () => {
        const count = await prisma.notification.count({
          where: {
            userId: created.patientId,
            entityId: booking.appointmentId,
            type: "APPOINTMENT_CANCELLED",
          },
        });
        return count === 1 ? count : null;
      }),
    () => "created once",
  );

  const releasedSlot = await prisma.doctorTimeSlot.findUniqueOrThrow({
    where: { id: slot.id },
    select: { status: true, appointment: { select: { id: true } } },
  });
  if (releasedSlot.status !== "AVAILABLE" || releasedSlot.appointment) {
    throw new Error("Cancelled appointment did not release its temporary slot.");
  }
} catch (error) {
  failure = error;
} finally {
  try {
    await timed("cleanup", cleanup, () => "temporary records removed");
  } catch (cleanupError) {
    failure ||= cleanupError;
    console.error(
      `[REMOTE_ACCEPTANCE_CLEANUP_ERROR] ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
    );
  }
  await prisma.$disconnect();
}

if (failure) {
  console.error(
    `[REMOTE_ACCEPTANCE_FAILED] ${failure instanceof Error ? failure.message : String(failure)}`,
  );
  console.error(JSON.stringify({ ok: false, steps }, null, 2));
  process.exit(1);
}

console.log(
  `[REMOTE_ACCEPTANCE_RESULT] ${JSON.stringify({
    ok: true,
    apiBaseUrl,
    steps,
    temporaryDataRemoved: true,
  })}`,
);
