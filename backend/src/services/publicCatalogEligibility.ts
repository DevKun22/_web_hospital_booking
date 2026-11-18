import { Prisma } from "../../generated/prisma/client.js";
import { getVietnamNowParts, parseDateOnly } from "../utils/time.js";

const FEATURED_AVAILABILITY_DAYS = 14;

// Cửa sổ "còn giờ trống": hôm nay sau giờ hiện tại và các ngày tới trong availabilityDays. Một nguồn duy nhất cho cả
// bộ lọc Prisma lẫn truy vấn SQL thô.
export const getFeaturedAvailabilityWindow = (availabilityDays = FEATURED_AVAILABILITY_DAYS) => {
  const vietnamNow = getVietnamNowParts();
  const today = parseDateOnly(vietnamNow.date);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const endExclusive = new Date(today);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + availabilityDays);
  return { today, nowTime: vietnamNow.time, tomorrow, endExclusive };
};

export const buildFeaturedSlotWhere = (
  availabilityDays = FEATURED_AVAILABILITY_DAYS,
): Prisma.DoctorTimeSlotWhereInput => {
  const { today, nowTime, tomorrow, endExclusive } = getFeaturedAvailabilityWindow(availabilityDays);

  return {
    status: "AVAILABLE",
    isActive: true,
    OR: [
      {
        date: today,
        startTime: { gt: nowTime },
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
