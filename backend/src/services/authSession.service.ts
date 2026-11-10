import crypto from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import type { SessionKind } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import {
  getEffectivePatientExpiry,
  isPatientWebPlatform,
  patientSessionPolicy,
} from "../config/patientSessionPolicy.js";
import { AppError } from "../utils/appError.js";

export type SessionMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
};

export type PushTokenRegistration = {
  sessionId: string;
  userId: string;
  kind: SessionKind;
  pushToken: string;
  platform?: string;
  appVersion?: string;
};

const createOpaqueToken = () => crypto.randomBytes(48).toString("base64url");

export const hashRefreshToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const normalize = (value?: string, lowercase = false) => {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized ? (lowercase ? normalized.toLowerCase() : normalized) : null;
};

const normalizeMeta = (meta: SessionMeta) => ({
  ipAddress: normalize(meta.ipAddress),
  userAgent: normalize(meta.userAgent),
  deviceId: normalize(meta.deviceId),
  deviceName: normalize(meta.deviceName),
  platform: normalize(meta.platform, true),
  appVersion: normalize(meta.appVersion),
});

class RefreshRotationConflict extends Error {}

class AuthSessionService {
  async create(input: {
    userId: string;
    kind: SessionKind;
    expiresAt: Date;
    meta?: SessionMeta;
  }) {
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const meta = normalizeMeta(input.meta || {});

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.dashboardSession.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          refreshTokenHash,
          expiresAt: input.expiresAt,
          lastUsedAt: new Date(),
          ...meta,
        },
        select: {
          id: true,
          tokenFamilyId: true,
          expiresAt: true,
        },
      });

      await tx.authRefreshToken.create({
        data: {
          sessionId: created.id,
          userId: input.userId,
          tokenHash: refreshTokenHash,
          expiresAt: input.expiresAt,
        },
      });

      return created;
    });

    return { session, refreshToken };
  }

  async rotate(input: {
    refreshToken: string;
    kind: SessionKind;
    expiresAt: Date;
    meta?: SessionMeta;
  }) {
    const currentHash = hashRefreshToken(input.refreshToken);
    const storedToken = await prisma.authRefreshToken.findUnique({
      where: { tokenHash: currentHash },
      include: {
        session: { include: { user: true } },
      },
    });

    if (!storedToken || storedToken.session.kind !== input.kind) {
      throw new AppError("Phiên đăng nhập không hợp lệ", 401, "INVALID_REFRESH_TOKEN");
    }

    const now = new Date();
    const session = storedToken.session;
    const lastUsedAt = session.lastUsedAt ?? session.createdAt;
    const isPatientSession = input.kind === "PATIENT";
    const effectiveExpiresAt = isPatientSession
      ? getEffectivePatientExpiry({
          platform: session.platform,
          createdAt: session.createdAt,
          storedExpiresAt: session.expiresAt,
        })
      : input.expiresAt;
    const isReuse = Boolean(
      storedToken.usedAt ||
        storedToken.replacedByTokenHash ||
        storedToken.revokedAt,
    );

    if (isReuse) {
      await this.revokeFamily(session.id, now);
      throw new AppError(
        "Refresh token đã được sử dụng lại; toàn bộ phiên đã bị thu hồi",
        401,
        "REFRESH_TOKEN_REUSE",
      );
    }

    if (
      session.revokedAt ||
      effectiveExpiresAt <= now ||
      storedToken.expiresAt <= now
    ) {
      if (!session.revokedAt) await this.revokeFamily(session.id, now);
      throw new AppError("Phiên đăng nhập đã hết hạn", 401, "SESSION_EXPIRED");
    }

    if (
      isPatientSession &&
      isPatientWebPlatform(session.platform) &&
      now.getTime() - lastUsedAt.getTime() >=
        patientSessionPolicy.webIdleMs
    ) {
      await this.revokeFamily(session.id, now);
      throw new AppError(
        "Phiên đã tự động kết thúc do không hoạt động",
        401,
        "SESSION_IDLE_TIMEOUT",
      );
    }

    const nextRefreshToken = createOpaqueToken();
    const nextHash = hashRefreshToken(nextRefreshToken);
    const meta = normalizeMeta(input.meta || {});

    try {
      await prisma.$transaction(async (tx) => {
        const consumed = await tx.authRefreshToken.updateMany({
          where: {
            id: storedToken.id,
            usedAt: null,
            revokedAt: null,
          },
          data: {
            usedAt: now,
            replacedByTokenHash: nextHash,
          },
        });

        if (consumed.count !== 1) throw new RefreshRotationConflict();

        const updatedSession = await tx.dashboardSession.updateMany({
          where: {
            id: session.id,
            kind: input.kind,
            revokedAt: null,
            refreshTokenHash: currentHash,
            expiresAt: { gt: now },
          },
          data: {
            refreshTokenHash: nextHash,
            expiresAt: effectiveExpiresAt,
            lastUsedAt: now,
            ...meta,
            // Platform determines the patient-session security policy and is
            // immutable after login, even if a refresh request is spoofed.
            ...(isPatientSession ? { platform: session.platform } : {}),
          },
        });

        if (updatedSession.count !== 1) throw new RefreshRotationConflict();

        await tx.authRefreshToken.create({
          data: {
            sessionId: session.id,
            userId: session.userId,
            tokenHash: nextHash,
            expiresAt: effectiveExpiresAt,
          },
        });
      });
    } catch (error) {
      if (!(error instanceof RefreshRotationConflict)) throw error;

      await this.revokeFamily(session.id, now);
      throw new AppError(
        "Phát hiện refresh token được sử dụng đồng thời; phiên đã bị thu hồi",
        401,
        "REFRESH_TOKEN_REUSE",
      );
    }

    return {
      session: {
        id: session.id,
        tokenFamilyId: session.tokenFamilyId,
        expiresAt: effectiveExpiresAt,
      },
      user: session.user,
      refreshToken: nextRefreshToken,
    };
  }

  async revokeByRefreshToken(refreshToken?: string, kind?: SessionKind) {
    if (!refreshToken) return;

    const token = await prisma.authRefreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { sessionId: true, session: { select: { kind: true } } },
    });

    if (!token || (kind && token.session.kind !== kind)) return;
    await this.revokeFamily(token.sessionId);
  }

  async revokeSession(input: {
    sessionId: string;
    userId: string;
    kind: SessionKind;
    exceptSessionId?: string;
  }) {
    if (input.sessionId === input.exceptSessionId) {
      throw new AppError("Không thể thu hồi phiên hiện tại bằng endpoint này", 409);
    }

    const result = await prisma.dashboardSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        kind: input.kind,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        pushToken: null,
        pushDisabledAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new AppError("Không tìm thấy phiên đăng nhập", 404);
    }

    await prisma.authRefreshToken.updateMany({
      where: { sessionId: input.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Thu hồi mọi phiên của một người dùng (trừ phiên được giữ lại), ví dụ khi đổi hoặc đặt lại
  // mật khẩu: bắt buộc đăng nhập lại bằng mật khẩu mới.
  async revokeAllForUser(
    input: {
      userId: string;
      kind: SessionKind;
      exceptSessionId?: string;
    },
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const now = new Date();
    const sessions = await client.dashboardSession.findMany({
      where: {
        userId: input.userId,
        kind: input.kind,
        revokedAt: null,
        ...(input.exceptSessionId ? { id: { not: input.exceptSessionId } } : {}),
      },
      select: { id: true },
    });
    if (sessions.length === 0) return 0;

    const ids = sessions.map((session) => session.id);
    await client.dashboardSession.updateMany({
      where: { id: { in: ids } },
      data: { revokedAt: now, pushToken: null, pushDisabledAt: now },
    });
    await client.authRefreshToken.updateMany({
      where: { sessionId: { in: ids }, revokedAt: null },
      data: { revokedAt: now },
    });
    return ids.length;
  }

  async registerPushToken(input: PushTokenRegistration) {
    const now = new Date();
    const pushToken = input.pushToken.trim();
    const platform = normalize(input.platform, true);
    const appVersion = normalize(input.appVersion);

    return prisma.$transaction(async (tx) => {
      const session = await tx.dashboardSession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
          kind: input.kind,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });

      if (!session) {
        throw new AppError(
          "Phiên đăng nhập không hợp lệ",
          401,
          "SESSION_REVOKED",
        );
      }

      // Một FCM token đại diện cho một installation. Khi người dùng đăng nhập
      // lại, chuyển quyền sở hữu token sang phiên hiện tại thay vì gửi trùng.
      await tx.dashboardSession.updateMany({
        where: {
          pushToken,
          id: { not: input.sessionId },
        },
        data: {
          pushToken: null,
          pushDisabledAt: now,
        },
      });

      const updated = await tx.dashboardSession.update({
        where: { id: input.sessionId },
        data: {
          pushToken,
          pushTokenUpdatedAt: now,
          pushDisabledAt: null,
          ...(platform === undefined ? {} : { platform }),
          ...(appVersion === undefined ? {} : { appVersion }),
        },
        select: {
          pushTokenUpdatedAt: true,
        },
      });

      // Nếu người khám bật push sau khi lịch đã được xác nhận, gắn phiên mới
      // vào các thông báo đã lên lịch để không bỏ lỡ lời nhắc sắp tới.
      const scheduledNotifications = await tx.notification.findMany({
        where: {
          userId: input.userId,
          publishedAt: null,
          cancelledAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
        take: 100,
      });
      if (scheduledNotifications.length > 0) {
        await tx.notificationDelivery.createMany({
          data: scheduledNotifications.map((notification) => ({
            notificationId: notification.id,
            sessionId: input.sessionId,
          })),
          skipDuplicates: true,
        });
      }

      return {
        enabled: true,
        updatedAt: updated.pushTokenUpdatedAt,
      };
    });
  }

  async disablePushToken(input: {
    sessionId: string;
    userId: string;
    kind: SessionKind;
  }) {
    const now = new Date();
    const updated = await prisma.dashboardSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        kind: input.kind,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        pushToken: null,
        pushDisabledAt: now,
      },
    });

    if (updated.count !== 1) {
      throw new AppError(
        "Phiên đăng nhập không hợp lệ",
        401,
        "SESSION_REVOKED",
      );
    }

    return { enabled: false, disabledAt: now };
  }

  async list(userId: string, kind: SessionKind, currentSessionId: string) {
    const now = new Date();
    const sessions = await prisma.dashboardSession.findMany({
      where: { userId, kind, revokedAt: null, expiresAt: { gt: now } },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        ipAddress: true,
        userAgent: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    });

    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }

  async getActiveDashboardIdentity(input: {
    sessionId: string;
    userId: string;
  }) {
    const session = await prisma.dashboardSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        kind: "DASHBOARD",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
      },
    });

    if (!session) {
      throw new AppError("Phiên đăng nhập không hợp lệ", 401, "SESSION_REVOKED");
    }

    return session.user;
  }

  async assertActivePatientSession(input: {
    sessionId: string;
    userId: string;
  }) {
    const now = new Date();
    const session = await prisma.dashboardSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        kind: "PATIENT",
        revokedAt: null,
        expiresAt: { gt: now },
        user: {
          role: "PATIENT",
          isActive: true,
          isPhoneVerified: true,
        },
      },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
      },
    });

    if (!session) {
      throw new AppError(
        "Phiên đăng nhập không hợp lệ",
        401,
        "SESSION_REVOKED",
      );
    }

    const effectiveExpiresAt = getEffectivePatientExpiry({
      platform: session.platform,
      createdAt: session.createdAt,
      storedExpiresAt: session.expiresAt,
    });
    const lastUsedAt = session.lastUsedAt ?? session.createdAt;
    if (effectiveExpiresAt <= now) {
      await this.revokeFamily(session.id, now);
      throw new AppError("Phiên đăng nhập đã hết hạn", 401, "SESSION_EXPIRED");
    }

    if (
      isPatientWebPlatform(session.platform) &&
      now.getTime() - lastUsedAt.getTime() >=
        patientSessionPolicy.webIdleMs
    ) {
      await this.revokeFamily(session.id, now);
      throw new AppError(
        "Phiên đã tự động kết thúc do không hoạt động",
        401,
        "SESSION_IDLE_TIMEOUT",
      );
    }

    const touchBefore = new Date(
      now.getTime() - patientSessionPolicy.activityTouchMs,
    );
    if (lastUsedAt <= touchBefore) {
      await prisma.dashboardSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          lastUsedAt: { lte: touchBefore },
        },
        data: { lastUsedAt: now },
      });
    }
  }

  private async revokeFamily(
    sessionId: string,
    revokedAt = new Date(),
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    await tx.dashboardSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: {
        revokedAt,
        pushToken: null,
        pushDisabledAt: revokedAt,
      },
    });
    await tx.authRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }
}

export default new AuthSessionService();
