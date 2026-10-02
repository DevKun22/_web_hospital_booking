import crypto from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import type { SessionKind } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

export type SessionMeta = {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
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
      session.expiresAt <= now ||
      storedToken.expiresAt <= now
    ) {
      throw new AppError("Phiên đăng nhập đã hết hạn", 401, "SESSION_EXPIRED");
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
            expiresAt: input.expiresAt,
            lastUsedAt: now,
            ...meta,
          },
        });

        if (updatedSession.count !== 1) throw new RefreshRotationConflict();

        await tx.authRefreshToken.create({
          data: {
            sessionId: session.id,
            userId: session.userId,
            tokenHash: nextHash,
            expiresAt: input.expiresAt,
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
        expiresAt: input.expiresAt,
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
      data: { revokedAt: new Date() },
    });

    if (result.count !== 1) {
      throw new AppError("Không tìm thấy phiên đăng nhập", 404);
    }

    await prisma.authRefreshToken.updateMany({
      where: { sessionId: input.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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

  async assertActiveSession(input: {
    sessionId: string;
    userId: string;
    kind: SessionKind;
  }) {
    const session = await prisma.dashboardSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        kind: input.kind,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) {
      throw new AppError("Phiên đăng nhập không hợp lệ", 401, "SESSION_REVOKED");
    }
  }

  private async revokeFamily(
    sessionId: string,
    revokedAt = new Date(),
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    await tx.dashboardSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
    await tx.authRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }
}

export default new AuthSessionService();
