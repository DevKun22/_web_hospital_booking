import { z } from "zod";

const fields = {
  name: z.string().trim().min(2, "Tên cơ sở tối thiểu 2 ký tự").max(160),
  address: z.string().trim().min(3, "Địa chỉ tối thiểu 3 ký tự").max(300),
  phone: z.string().trim().max(40).nullable().optional(),
  workingHours: z.string().trim().max(200).nullable().optional(),
  mapUrl: z.string().trim().url("Liên kết bản đồ không hợp lệ").max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

export const createFacilitySchema = z.object(fields);
export const updateFacilitySchema = z.object({ ...fields, name: fields.name.optional(), address: fields.address.optional() });
