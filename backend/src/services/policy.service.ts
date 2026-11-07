import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import {
  getAppointmentReminderLeadMinutes,
  getBookingHoldMinutes,
} from "../config/environment.js";
import { AppError } from "../utils/appError.js";

export const POLICY_KEY = "policy";
const CACHE_TTL_MS = 15_000;

// Khoảng cho phép của từng tham số; ngoài khoảng bị từ chối khi lưu và bị bỏ
// qua (dùng mặc định) khi đọc, để cấu hình hỏng không làm sập đặt lịch.
export const POLICY_LIMITS = {
  bookingHoldMinutes: { min: 1, max: 60 },
  reminderLeadMinutes: { min: 15, max: 1440 },
  patientCancelCutoffHours: { min: 0, max: 72 },
  noShowGraceMinutes: { min: 0, max: 240 },
} as const;

export type PolicyKey = keyof typeof POLICY_LIMITS;
export type Policy = Record<PolicyKey, number>;

export const getPolicyDefaults = (env: NodeJS.ProcessEnv = process.env): Policy => ({
  bookingHoldMinutes: getBookingHoldMinutes(env),
  reminderLeadMinutes: getAppointmentReminderLeadMinutes(env),
  // Người khám không tự hủy trong 2 giờ trước giờ khám.
  patientCancelCutoffHours: 2,
  // 0 = tắt tự động đánh dấu vắng mặt.
  noShowGraceMinutes: 0,
});

const isValid = (key: PolicyKey, value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= POLICY_LIMITS[key].min &&
  value <= POLICY_LIMITS[key].max;

export const resolvePolicy = (
  stored: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Policy => {
  const policy = getPolicyDefaults(env);
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of Object.keys(POLICY_LIMITS) as PolicyKey[]) {
      const value = (stored as Record<string, unknown>)[key];
      if (isValid(key, value)) policy[key] = value;
    }
  }
  return policy;
};

let cache: { policy: Policy; expiresAt: number } | null = null;

class PolicyService {
  invalidate() {
    cache = null;
  }

  async get(): Promise<Policy> {
    if (cache && cache.expiresAt > Date.now()) return cache.policy;

    const setting = await prisma.siteSetting.findUnique({
      where: { key: POLICY_KEY },
      select: { value: true, isActive: true },
    });
    const policy = resolvePolicy(setting?.isActive ? setting.value : undefined);
    cache = { policy, expiresAt: Date.now() + CACHE_TTL_MS };
    return policy;
  }

  async update(input: Partial<Policy>) {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in POLICY_LIMITS)) {
        throw new AppError(`Tham số không tồn tại: ${key}`, 400, "POLICY_UNKNOWN_KEY");
      }
      if (!isValid(key as PolicyKey, value)) {
        const { min, max } = POLICY_LIMITS[key as PolicyKey];
        throw new AppError(
          `${key} phải là số nguyên từ ${min} đến ${max}`,
          400,
          "POLICY_OUT_OF_RANGE",
        );
      }
    }

    const next = { ...(await this.get()), ...input };
    const value = next as unknown as Prisma.InputJsonValue;
    await prisma.siteSetting.upsert({
      where: { key: POLICY_KEY },
      create: { key: POLICY_KEY, value, description: "Tham số chính sách đặt lịch" },
      update: { value, isActive: true },
    });
    this.invalidate();
    return this.get();
  }

  async reset() {
    await prisma.siteSetting.deleteMany({ where: { key: POLICY_KEY } });
    this.invalidate();
    return this.get();
  }
}

export default new PolicyService();
