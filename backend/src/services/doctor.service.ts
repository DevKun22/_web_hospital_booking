import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import SearchIndexer from "./search/search.indexer.js";

type CreateDoctorProfileInput = {
  userId: string;
  departmentId: string;
  title?: string | null;
  bio?: string | null;
  specialization?: string | null;
  experience?: number;
  consultationFee?: number;
  isAvailable?: boolean;
};

type UpdateDoctorProfileInput = {
  departmentId?: string;
  title?: string | null;
  bio?: string | null;
  specialization?: string | null;
  experience?: number | null;
  consultationFee?: number;
  isAvailable?: boolean;
};

const doctorProfileSelect = {
  id: true,
  slug: true,
  title: true,
  bio: true,
  specialization: true,
  experience: true,
  consultationFee: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      avatar: true,
      isActive: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  },
  _count: {
    select: {
      appointments: true,
      schedules: true,
      timeSlots: true,
    },
  },
} satisfies Prisma.DoctorProfileSelect;

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

class DoctorService {
  private async createUniqueSlug(fullName: string, userId: string) {
    const baseSlug = createSlug(fullName) || `bac-si-${userId.slice(0, 8)}`;
    const existing = await prisma.doctorProfile.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });

    return existing ? `${baseSlug}-${userId.slice(0, 8)}` : baseSlug;
  }

  async list(query: {
    search?: string;
    departmentId?: string;
    isAvailable?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DoctorProfileWhereInput = {
      departmentId: query.departmentId,
      isAvailable: query.isAvailable,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { specialization: { contains: query.search, mode: "insensitive" } },
        { user: { fullName: { contains: query.search, mode: "insensitive" } } },
        { user: { phone: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.doctorProfile.findMany({
        where,
        select: doctorProfileSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.doctorProfile.count({ where }),
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

  async getById(id: string) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id },
      select: doctorProfileSelect,
    });

    if (!doctor) {
      throw new AppError("Không tìm thấy hồ sơ bác sĩ", 404);
    }

    return doctor;
  }

  async create(input: CreateDoctorProfileInput) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        fullName: true,
        role: true,
        doctorProfile: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new AppError("Không tìm thấy tài khoản bác sĩ", 404);
    }

    if (user.role !== "DOCTOR") {
      throw new AppError("Tài khoản phải có vai trò DOCTOR", 400);
    }

    if (user.doctorProfile) {
      throw new AppError("Tài khoản này đã có hồ sơ bác sĩ", 409);
    }

    const department = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true, isActive: true },
    });

    if (!department) {
      throw new AppError("Không tìm thấy chuyên khoa", 404);
    }

    const doctor = await prisma.doctorProfile.create({
      data: {
        slug: await this.createUniqueSlug(user.fullName, user.id),
        userId: input.userId,
        departmentId: input.departmentId,
        title: normalizeOptionalString(input.title),
        bio: normalizeOptionalString(input.bio),
        specialization: normalizeOptionalString(input.specialization),
        experience: input.experience,
        consultationFee: input.consultationFee ?? 0,
        isAvailable: input.isAvailable ?? true,
      },
      select: doctorProfileSelect,
    });

    await SearchIndexer.syncDoctor(doctor.id);

    return doctor;
  }

  async update(id: string, input: UpdateDoctorProfileInput) {
    await this.getById(id);

    if (input.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true },
      });

      if (!department) {
        throw new AppError("Không tìm thấy chuyên khoa", 404);
      }
    }

    const doctor = await prisma.doctorProfile.update({
      where: { id },
      data: {
        departmentId: input.departmentId,
        title: normalizeOptionalString(input.title),
        bio: normalizeOptionalString(input.bio),
        specialization: normalizeOptionalString(input.specialization),
        experience: input.experience,
        consultationFee: input.consultationFee,
        isAvailable: input.isAvailable,
      },
      select: doctorProfileSelect,
    });

    await SearchIndexer.syncDoctor(doctor.id);

    return doctor;
  }

  async updateAvailability(id: string, isAvailable: boolean) {
    await this.getById(id);

    const doctor = await prisma.doctorProfile.update({
      where: { id },
      data: {
        isAvailable,
      },
      select: doctorProfileSelect,
    });

    await SearchIndexer.syncDoctor(doctor.id);

    return doctor;
  }

  async delete(id: string) {
    const doctor = await this.getById(id);

    if (
      doctor._count.appointments > 0 ||
      doctor._count.schedules > 0 ||
      doctor._count.timeSlots > 0
    ) {
      throw new AppError(
        "Không thể xóa bác sĩ đã có lịch hẹn hoặc lịch làm việc",
        409,
      );
    }

    await prisma.doctorProfile.delete({
      where: { id },
    });

    await SearchIndexer.remove("doctor", id);

    return doctor;
  }
}

export default new DoctorService();
