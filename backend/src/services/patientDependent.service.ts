import type {
  DependentRelationship,
  Gender,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { parseDateOnly } from "../utils/time.js";

type DependentInput = {
  fullName?: string;
  relationship?: DependentRelationship;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  cccd?: string | null;
  address?: string | null;
  hasBHYT?: boolean;
  healthInsuranceCode?: string | null;
  registeredHospital?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  familyHistory?: string | null;
  consentConfirmed?: true;
};

const dependentSelect = {
  id: true,
  fullName: true,
  relationship: true,
  phone: true,
  email: true,
  dateOfBirth: true,
  gender: true,
  cccd: true,
  address: true,
  hasBHYT: true,
  healthInsuranceCode: true,
  registeredHospital: true,
  allergies: true,
  medicalHistory: true,
  familyHistory: true,
  isActive: true,
  consentConfirmedAt: true,
  consentVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

const normalizeNullable = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const resolveDateOfBirth = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = parseDateOnly(value);
  const today = parseDateOnly(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
  );
  if (date >= today) {
    throw new AppError("Ngày sinh phải nhỏ hơn ngày hiện tại", 400);
  }
  return date;
};

const dataFromInput = (input: DependentInput) => {
  const email = normalizeNullable(input.email);
  return {
    fullName: input.fullName?.trim(),
    relationship: input.relationship,
    phone: normalizeNullable(input.phone),
    email: email?.toLowerCase() ?? email,
    dateOfBirth: resolveDateOfBirth(input.dateOfBirth),
    gender: input.gender,
    cccd: normalizeNullable(input.cccd),
    address: normalizeNullable(input.address),
    hasBHYT: input.hasBHYT,
    healthInsuranceCode:
      input.hasBHYT === false
        ? null
        : normalizeNullable(input.healthInsuranceCode),
    registeredHospital:
      input.hasBHYT === false
        ? null
        : normalizeNullable(input.registeredHospital),
    allergies: normalizeNullable(input.allergies),
    medicalHistory: normalizeNullable(input.medicalHistory),
    familyHistory: normalizeNullable(input.familyHistory),
  };
};

const translateIdentityConflict = (error: unknown): never => {
  if ((error as { code?: string }).code === "P2002") {
    throw new AppError(
      "CCCD này đã thuộc một hồ sơ người thân khác",
      409,
      "DEPENDENT_IDENTITY_CONFLICT",
    );
  }
  throw error;
};

class PatientDependentService {
  async list(ownerId: string) {
    return prisma.dependentProfile.findMany({
      where: { ownerId, isActive: true },
      select: dependentSelect,
      orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
    });
  }

  async getOwned(ownerId: string, id: string) {
    const dependent = await prisma.dependentProfile.findFirst({
      where: { id, ownerId, isActive: true },
      select: dependentSelect,
    });
    if (!dependent) {
      throw new AppError("Không tìm thấy hồ sơ người thân", 404);
    }
    return dependent;
  }

  async create(ownerId: string, input: DependentInput) {
    const activeCount = await prisma.dependentProfile.count({
      where: { ownerId, isActive: true },
    });
    if (activeCount >= 20) {
      throw new AppError(
        "Mỗi tài khoản chỉ được quản lý tối đa 20 hồ sơ người thân",
        409,
        "DEPENDENT_LIMIT_REACHED",
      );
    }

    const data = dataFromInput(input);
    const archived = data.cccd
      ? await prisma.dependentProfile.findFirst({
          where: { ownerId, cccd: data.cccd, isActive: false },
          select: { id: true },
        })
      : null;

    try {
      if (archived) {
        return await prisma.dependentProfile.update({
          where: { id: archived.id },
          data: {
            ...data,
            fullName: input.fullName!.trim(),
            relationship: input.relationship!,
            isActive: true,
            consentConfirmedAt: new Date(),
            consentVersion: "v1",
          },
          select: dependentSelect,
        });
      }

      return await prisma.dependentProfile.create({
        data: {
          ownerId,
          ...data,
          fullName: input.fullName!.trim(),
          relationship: input.relationship!,
          consentConfirmedAt: new Date(),
          consentVersion: "v1",
        },
        select: dependentSelect,
      });
    } catch (error) {
      translateIdentityConflict(error);
    }
  }

  async update(ownerId: string, id: string, input: DependentInput) {
    await this.getOwned(ownerId, id);
    try {
      return await prisma.dependentProfile.update({
        where: { id },
        data: dataFromInput(input),
        select: dependentSelect,
      });
    } catch (error) {
      translateIdentityConflict(error);
    }
  }

  async archive(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    await prisma.dependentProfile.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, archived: true };
  }
}

export default new PatientDependentService();
