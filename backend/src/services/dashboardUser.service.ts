import { STAFF_ROLES, type StaffRole } from "../config/permissions.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { Role } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import { AppError } from "../utils/appError.js";
import MediaAssetService from "./mediaAsset.service.js";
import { invalidateDashboardAuthSnapshot } from "./dashboardAuthCache.service.js";

type DashboardRole = StaffRole;
type Actor = { userId: string; role: Role };

type CreateDashboardUserInput = {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
  role: DashboardRole;
  avatar?: string;
  avatarAssetId?: string;
  isActive?: boolean;
};

type UpdateDashboardUserInput = {
  fullName?: string;
  email?: string | null;
  phone?: string;
  role?: DashboardRole;
  avatar?: string | null;
  avatarAssetId?: string | null;
  isActive?: boolean;
};

const DASHBOARD_ROLES: Role[] = [...STAFF_ROLES];

const dashboardUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  isActive: true,
  isPhoneVerified: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const ensureDashboardRole = (role: Role) => {
  if (!DASHBOARD_ROLES.includes(role)) {
    throw new AppError("Vai trò không hợp lệ cho dashboard", 400);
  }
};

const normalizeOptionalString = (value?: string | null) =>
  value === undefined ? undefined : value || null;

class DashboardUserService {
  async list(query: {
    search?: string;
    role?: Role;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    if (query.role) {
      ensureDashboardRole(query.role);
    }

    const where: Prisma.UserWhereInput = {
      role: query.role ? query.role : { in: DASHBOARD_ROLES },
      isActive: query.isActive,
    };

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: dashboardUserSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
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
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: {
          in: DASHBOARD_ROLES,
        },
      },
      select: dashboardUserSelect,
    });

    if (!user) {
      throw new AppError("Không tìm thấy tài khoản dashboard", 404);
    }

    return user;
  }

  async create(input: CreateDashboardUserInput) {
    ensureDashboardRole(input.role);
    const avatarAsset = input.avatarAssetId
      ? await MediaAssetService.getUsableAsset(input.avatarAssetId)
      : null;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: input.phone },
          ...(input.email ? [{ email: input.email }] : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new AppError("Số điện thoại hoặc email đã tồn tại", 409);
    }

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        password: await hashPassword(input.password),
        role: input.role,
        avatar: avatarAsset?.url || input.avatar,
        isActive: input.isActive ?? true,
        isPhoneVerified: true,
      },
      select: dashboardUserSelect,
    });

    if (avatarAsset) {
      await MediaAssetService.attachAsset(
        avatarAsset.id,
        "USER_AVATAR",
        user.id,
      );
    }

    return user;
  }

  async update(id: string, input: UpdateDashboardUserInput, actor: Actor) {
    const currentUser = await this.getById(id);
    this.assertSelfAdministration(id, input, actor);
    await this.assertActiveAdminContinuity(currentUser, input);

    if (input.role) {
      ensureDashboardRole(input.role);
    }

    if (input.phone || input.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [
            ...(input.phone ? [{ phone: input.phone }] : []),
            ...(input.email ? [{ email: input.email }] : []),
          ],
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new AppError("Số điện thoại hoặc email đã tồn tại", 409);
      }
    }

    const avatarAsset =
      input.avatarAssetId === null
        ? null
        : input.avatarAssetId
          ? await MediaAssetService.attachAsset(
              input.avatarAssetId,
              "USER_AVATAR",
              id,
            )
          : undefined;

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        fullName: input.fullName,
        email: normalizeOptionalString(input.email),
        phone: input.phone,
        role: input.role,
        avatar:
          input.avatarAssetId === null
            ? null
            : avatarAsset
              ? avatarAsset.url
              : normalizeOptionalString(input.avatar),
        isActive: input.isActive,
      },
      select: dashboardUserSelect,
    });

    if (avatarAsset || input.avatarAssetId === null) {
      await MediaAssetService.detachOwnerAssets(
        "USER_AVATAR",
        id,
        avatarAsset?.id,
      );
    }

    invalidateDashboardAuthSnapshot(id);

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: id },
      select: { id: true },
    });
    if (doctorProfile) {
    }

    return user;
  }

  async updateStatus(id: string, isActive: boolean, actor: Actor) {
    const currentUser = await this.getById(id);
    this.assertSelfAdministration(id, { isActive }, actor);
    await this.assertActiveAdminContinuity(currentUser, { isActive });

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
      select: dashboardUserSelect,
    });

    invalidateDashboardAuthSnapshot(id);

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: id },
      select: { id: true },
    });
    if (doctorProfile) {
    }

    return user;
  }

  async updatePassword(id: string, password: string) {
    await this.getById(id);

    return prisma.user.update({
      where: {
        id,
      },
      data: {
        password: await hashPassword(password),
      },
      select: dashboardUserSelect,
    });
  }

  private assertSelfAdministration(
    id: string,
    input: UpdateDashboardUserInput,
    actor: Actor,
  ) {
    if (actor.userId !== id) return;

    if (input.isActive === false) {
      throw new AppError("Bạn không thể tự khóa tài khoản đang đăng nhập", 400);
    }

    if (input.role && input.role !== "ADMIN") {
      throw new AppError(
        "Bạn không thể tự thay đổi quyền quản trị của chính mình",
        400,
      );
    }
  }

  private async assertActiveAdminContinuity(
    currentUser: { id: string; role: Role; isActive: boolean },
    input: UpdateDashboardUserInput,
  ) {
    const removesActiveAdmin =
      currentUser.role === "ADMIN" &&
      currentUser.isActive &&
      (input.isActive === false ||
        (input.role !== undefined && input.role !== "ADMIN"));

    if (!removesActiveAdmin) return;

    const otherActiveAdmins = await prisma.user.count({
      where: { id: { not: currentUser.id }, role: "ADMIN", isActive: true },
    });

    if (otherActiveAdmins === 0) {
      throw new AppError(
        "Không thể vô hiệu hóa hoặc đổi quyền của quản trị viên hoạt động cuối cùng",
        409,
      );
    }
  }
}

export default new DashboardUserService();
