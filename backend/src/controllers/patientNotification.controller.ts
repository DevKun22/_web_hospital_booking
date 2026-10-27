import type { NextFunction, Request, Response } from "express";
import NotificationService from "../services/notification.service.js";
import NotificationPreferenceService, {
  notificationPreferenceKeys,
  type NotificationPushPreferences,
} from "../services/notificationPreference.service.js";
import { AppError } from "../utils/appError.js";
import { parsePagination } from "../utils/pagination.js";

const requirePatientId = (req: Request) => {
  if (!req.patient?.userId) throw new AppError("Vui lòng đăng nhập", 401);
  return req.patient.userId;
};

const notificationId = (req: Request) => {
  const raw = req.params.id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new AppError("Thiếu notification id", 400);
  return value;
};

const parseUnreadOnly = (value: unknown) => {
  if (value === undefined) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(
    "unread phải là true hoặc false",
    400,
    "VALIDATION_ERROR",
  );
};

const parsePreferenceChanges = (
  value: unknown,
): Partial<NotificationPushPreferences> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(
      "Tùy chọn thông báo không hợp lệ",
      400,
      "VALIDATION_ERROR",
    );
  }

  const body = value as Record<string, unknown>;
  const unknownKeys = Object.keys(body).filter(
    (key) =>
      !notificationPreferenceKeys.includes(
        key as (typeof notificationPreferenceKeys)[number],
      ),
  );
  if (unknownKeys.length > 0) {
    throw new AppError(
      "Tùy chọn thông báo chứa trường không được hỗ trợ",
      400,
      "VALIDATION_ERROR",
    );
  }

  const changes: Partial<NotificationPushPreferences> = {};
  for (const key of notificationPreferenceKeys) {
    if (!(key in body)) continue;
    if (typeof body[key] !== "boolean") {
      throw new AppError(
        "Giá trị tùy chọn thông báo phải là true hoặc false",
        400,
        "VALIDATION_ERROR",
      );
    }
    changes[key] = body[key];
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(
      "Cần chọn ít nhất một tùy chọn thông báo",
      400,
      "VALIDATION_ERROR",
    );
  }
  return changes;
};

export const listPatientNotificationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await NotificationService.listForPatient({
      userId: requirePatientId(req),
      page: pagination.page,
      limit: pagination.limit,
      unreadOnly: parseUnreadOnly(req.query.unread),
    });
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const getPatientUnreadNotificationCountHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const unreadCount = await NotificationService.unreadCount(
      requirePatientId(req),
    );
    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
};

export const markPatientNotificationReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await NotificationService.markRead(
      requirePatientId(req),
      notificationId(req),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const markAllPatientNotificationsReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await NotificationService.markAllRead(requirePatientId(req));
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPatientNotificationPreferencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await NotificationPreferenceService.get(
      requirePatientId(req),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updatePatientNotificationPreferencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await NotificationPreferenceService.update(
      requirePatientId(req),
      parsePreferenceChanges(req.body),
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
