import { Prisma } from "../../generated/prisma/client.js";
import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { hasTimeOverlap, validateTimeRange } from "../utils/time.js";

type Actor = {
  userId: string;
  role: Role;
};

type CreateDoctorScheduleInput = {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  maxPatients?: number;
  isActive?: boolean;
};

type UpdateDoctorScheduleInput = {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  slotDuration?: number;
  maxPatients?: number;
  isActive?: boolean;
};

const doctorScheduleSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  slotDuration: true,
  maxPatients: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  doctor: {
    select: {
      id: true,
      userId: true,
      title: true,
      specialization: true,
      user: {
        select: {
          fullName: true,
          avatar: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.DoctorScheduleSelect;

class DoctorScheduleService {
  async list(
    query: {
      doctorId?: string;
      dayOfWeek?: number;
      isActive?: boolean;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DoctorScheduleWhereInput = {
      doctorId: query.doctorId,
      dayOfWeek: query.dayOfWeek,
      isActive: query.isActive,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.doctorSchedule.findMany({
        where,
        select: doctorScheduleSelect,
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        skip,
        take: limit,
      }),
      prisma.doctorSchedule.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, actor: Actor) {
    const where: Prisma.DoctorScheduleWhereInput = {
      id,
    };

    if (actor.role === "DOCTOR") {
      where.doctor = {
        userId: actor.userId,
      };
    }

    const schedule = await prisma.doctorSchedule.findFirst({
      where,
      select: doctorScheduleSelect,
    });

    if (!schedule) {
      throw new AppError("Không tìm thấy lịch làm việc", 404);
    }

    return schedule;
  }

  async create(input: CreateDoctorScheduleInput) {
    validateTimeRange(input.startTime, input.endTime);
    if ((input.maxPatients ?? 1) !== 1) {
      throw new AppError("Mỗi slot hiện chỉ hỗ trợ một bệnh nhân", 400);
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: input.doctorId },
      select: { id: true },
    });

    if (!doctor) {
      throw new AppError("Không tìm thấy bác sĩ", 404);
    }

    if (input.isActive !== false) {
      await this.ensureNoOverlap({
        doctorId: input.doctorId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
      });
    }

    return prisma.doctorSchedule.create({
      data: {
        doctorId: input.doctorId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDuration: input.slotDuration ?? 30,
        maxPatients: input.maxPatients ?? 1,
        isActive: input.isActive ?? true,
      },
      select: doctorScheduleSelect,
    });
  }

  async update(id: string, input: UpdateDoctorScheduleInput) {
    const current = await prisma.doctorSchedule.findUnique({
      where: { id },
    });

    if (!current) {
      throw new AppError("Không tìm thấy lịch làm việc", 404);
    }

    const next = {
      doctorId: current.doctorId,
      dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
      startTime: input.startTime ?? current.startTime,
      endTime: input.endTime ?? current.endTime,
      isActive: input.isActive ?? current.isActive,
      maxPatients: input.maxPatients ?? current.maxPatients,
    };

    validateTimeRange(next.startTime, next.endTime);
    if (next.maxPatients !== 1) {
      throw new AppError("Mỗi slot hiện chỉ hỗ trợ một bệnh nhân", 400);
    }
    if (next.isActive) {
      await this.ensureNoOverlap({ ...next, excludeId: id });
    }

    return prisma.doctorSchedule.update({
      where: { id },
      data: input,
      select: doctorScheduleSelect,
    });
  }

  async delete(id: string) {
    const schedule = await this.getById(id, { userId: "", role: "ADMIN" });

    await prisma.doctorSchedule.delete({
      where: { id },
    });

    return schedule;
  }

  private async ensureNoOverlap(input: {
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    excludeId?: string;
  }) {
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: input.doctorId,
        dayOfWeek: input.dayOfWeek,
        isActive: true,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    const hasOverlap = schedules.some((schedule) =>
      hasTimeOverlap(
        input.startTime,
        input.endTime,
        schedule.startTime,
        schedule.endTime,
      ),
    );

    if (hasOverlap) {
      throw new AppError("Lịch làm việc bị trùng thời gian", 409);
    }
  }
}

export default new DoctorScheduleService();
