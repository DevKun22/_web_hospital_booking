import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { createSlug } from "../utils/slug.js";
import { normalizeOptionalString } from "../utils/text.js";

// Cơ sở khám mức nhỏ: danh mục các địa điểm khám. Đúng một cơ sở mặc định; lịch cũ chưa gán cơ sở được hiểu là cơ sở mặc định.

type FacilityInput = {
  name: string;
  address: string;
  phone?: string | null;
  workingHours?: string | null;
  mapUrl?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

const publicSelect = { id: true, name: true, slug: true, address: true, phone: true, workingHours: true, mapUrl: true, isDefault: true } as const;

class FacilityService {
  private async uniqueSlug(name: string, excludeId?: string) {
    const base = createSlug(name) || "co-so";
    for (let index = 0; index < 50; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const taken = await prisma.facility.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
      if (!taken) return slug;
    }
    throw new AppError("Không tạo được đường dẫn cho cơ sở", 409);
  }

  // Tự tạo cơ sở mặc định nếu chưa có (cơ sở dữ liệu mới hoặc chưa chạy bước chuyển dữ liệu).
  async ensureDefault() {
    const existing = await prisma.facility.findFirst({ where: { isDefault: true }, select: { id: true } });
    if (existing) return existing.id;
    const created = await prisma.facility.create({
      data: { name: "Cơ sở chính", slug: await this.uniqueSlug("Cơ sở chính"), address: "Chưa cập nhật địa chỉ", isDefault: true },
      select: { id: true },
    });
    return created.id;
  }

  // Cơ sở dùng cho ca làm việc mới: đúng cơ sở được chọn (phải đang hoạt động) hoặc cơ sở mặc định.
  async resolveId(facilityId?: string | null) {
    if (!facilityId) return this.ensureDefault();
    const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true, isActive: true } });
    if (!facility) throw new AppError("Không tìm thấy cơ sở", 404);
    if (!facility.isActive) throw new AppError("Cơ sở đang tạm ngừng hoạt động", 409, "FACILITY_INACTIVE");
    return facility.id;
  }

  listPublic() {
    return prisma.facility.findMany({ where: { isActive: true }, select: publicSelect, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  }

  async list() {
    await this.ensureDefault();
    return prisma.facility.findMany({
      select: { ...publicSelect, isActive: true, createdAt: true, updatedAt: true, _count: { select: { schedules: true, timeSlots: true, appointments: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(input: FacilityInput) {
    const hasDefault = await prisma.facility.count({ where: { isDefault: true } });
    const makeDefault = input.isDefault === true || hasDefault === 0;
    const data = {
      name: input.name.trim(),
      slug: await this.uniqueSlug(input.name),
      address: input.address.trim(),
      phone: normalizeOptionalString(input.phone),
      workingHours: normalizeOptionalString(input.workingHours),
      mapUrl: normalizeOptionalString(input.mapUrl),
      isDefault: makeDefault,
      isActive: input.isActive ?? true,
    };
    return prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.facility.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.facility.create({ data, select: publicSelect });
    });
  }

  async update(id: string, input: Partial<FacilityInput>) {
    const current = await prisma.facility.findUnique({ where: { id }, select: { id: true, isDefault: true, isActive: true } });
    if (!current) throw new AppError("Không tìm thấy cơ sở", 404);
    if (current.isDefault && input.isDefault === false) {
      throw new AppError("Phải luôn có một cơ sở mặc định: hãy đặt cơ sở khác làm mặc định thay vì bỏ cờ này.", 409, "FACILITY_DEFAULT_REQUIRED");
    }
    if (current.isDefault && input.isActive === false) {
      throw new AppError("Không thể tạm ngừng cơ sở mặc định. Hãy đặt cơ sở khác làm mặc định trước.", 409, "FACILITY_DEFAULT_REQUIRED");
    }
    return prisma.$transaction(async (tx) => {
      if (input.isDefault === true) await tx.facility.updateMany({ where: { id: { not: id }, isDefault: true }, data: { isDefault: false } });
      return tx.facility.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          ...(input.name ? { slug: await this.uniqueSlug(input.name, id) } : {}),
          address: input.address?.trim(),
          phone: input.phone === undefined ? undefined : normalizeOptionalString(input.phone),
          workingHours: input.workingHours === undefined ? undefined : normalizeOptionalString(input.workingHours),
          mapUrl: input.mapUrl === undefined ? undefined : normalizeOptionalString(input.mapUrl),
          isDefault: input.isDefault,
          isActive: input.isActive,
        },
        select: publicSelect,
      });
    });
  }

  async delete(id: string) {
    const facility = await prisma.facility.findUnique({
      where: { id },
      select: { id: true, isDefault: true, _count: { select: { schedules: true, timeSlots: true, appointments: true } } },
    });
    if (!facility) throw new AppError("Không tìm thấy cơ sở", 404);
    if (facility.isDefault) throw new AppError("Không thể xóa cơ sở mặc định.", 409, "FACILITY_DEFAULT_REQUIRED");
    if (facility._count.schedules + facility._count.timeSlots + facility._count.appointments > 0) {
      throw new AppError("Cơ sở đã có lịch làm việc hoặc lịch hẹn. Hãy tạm ngừng thay vì xóa.", 409, "FACILITY_IN_USE");
    }
    await prisma.facility.delete({ where: { id } });
    return { id };
  }
}

export default new FacilityService();
