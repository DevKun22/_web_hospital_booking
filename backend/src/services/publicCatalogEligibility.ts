import { Prisma } from "../../generated/prisma/client.js";
import { getVietnamNowParts, parseDateOnly } from "../utils/time.js";

export const FEATURED_AVAILABILITY_DAYS = 14;

export const buildFeaturedSlotWhere = (
  availabilityDays = FEATURED_AVAILABILITY_DAYS,
): Prisma.DoctorTimeSlotWhereInput => {
  const vietnamNow = getVietnamNowParts();
  const today = parseDateOnly(vietnamNow.date);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const endExclusive = new Date(today);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + availabilityDays);

  return {
    status: "AVAILABLE",
    isActive: true,
    OR: [
      {
        date: today,
        startTime: { gt: vietnamNow.time },
      },
      {
        date: {
          gte: tomorrow,
          lt: endExclusive,
        },
      },
    ],
  };
};

export const publicBookableDoctorWhere = (
  slotWhere = buildFeaturedSlotWhere(),
): Prisma.DoctorProfileWhereInput => ({
  isAvailable: true,
  user: { isActive: true },
  timeSlots: { some: slotWhere },
});

export const publicCompletePackageWhere: Prisma.PackageWhereInput = {
  slug: { not: null },
  items: { some: { included: true } },
  OR: [
    { departmentId: null },
    { department: { is: { isActive: true } } },
  ],
};
