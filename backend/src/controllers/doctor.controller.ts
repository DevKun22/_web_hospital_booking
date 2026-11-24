import type { Request, Response } from "express";
import DoctorService from "../services/doctor.service.js";
import DoctorProfileContentService from "../services/doctorProfileContent.service.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import PublicBootstrapService from "../services/publicBootstrap.service.js";
import { getRequiredPathParam as getParam, parseBooleanQuery, parseNumberQuery, parseStringQuery } from "../shared/http/requestParsers.js";

// Tên người đang thao tác, dùng làm "người duyệt" hiển thị công khai khi quản trị tự sửa phần giới thiệu.
const actorName = async (req: Request) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Chưa đăng nhập", 401);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  return user?.fullName ?? null;
};

const requireUserId = (req: Request) => {
  if (!req.user?.userId) throw new AppError("Chưa đăng nhập", 401);
  return req.user.userId;
};

export const getMyProfileContentHandler = async (req: Request, res: Response) => {
  return res.json({ success: true, data: await DoctorProfileContentService.getMine(requireUserId(req)) });
};

export const saveMyProfileDraftHandler = async (req: Request, res: Response) => {
  const data = await DoctorProfileContentService.saveDraft(requireUserId(req), req.body);
  return res.json({ success: true, message: "Đã gửi phần giới thiệu chờ duyệt", data });
};

export const discardMyProfileDraftHandler = async (req: Request, res: Response) => {
  const data = await DoctorProfileContentService.discardDraft(requireUserId(req));
  return res.json({ success: true, message: "Đã hủy bản chờ duyệt", data });
};

export const listPendingProfilesHandler = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await DoctorProfileContentService.listPending() });
};

export const approveProfileHandler = async (req: Request, res: Response) => {
  const reviewer = (await actorName(req)) ?? "Quản trị viên";
  const data = await DoctorProfileContentService.approve(getParam(req.params.id), reviewer);
  PublicBootstrapService.invalidate();
  return res.json({ success: true, message: "Đã duyệt phần giới thiệu", data });
};

export const rejectProfileHandler = async (req: Request, res: Response) => {
  const data = await DoctorProfileContentService.reject(getParam(req.params.id));
  return res.json({ success: true, message: "Đã từ chối bản chờ duyệt", data });
};

export const listDoctorsHandler = async (
  req: Request,
  res: Response,
) => {
  const result = await DoctorService.list({
    search:
      parseStringQuery(req.query.search),
    departmentId:
      parseStringQuery(req.query.departmentId),
    isAvailable: parseBooleanQuery(req.query.isAvailable),
    page: parseNumberQuery(req.query.page),
    limit: parseNumberQuery(req.query.limit),
  });

  return res.json({
    success: true,
    data: result,
  });
};

export const getDoctorHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await DoctorService.getById(getParam(req.params.id));

  return res.json({
    success: true,
    data: doctor,
  });
};

export const createDoctorHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await DoctorService.create(req.body, await actorName(req));
  PublicBootstrapService.invalidate();

  return res.status(201).json({
    success: true,
    message: "Tạo hồ sơ bác sĩ thành công",
    data: doctor,
  });
};

export const updateDoctorHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await DoctorService.update(
    getParam(req.params.id),
    req.body,
    await actorName(req),
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật hồ sơ bác sĩ thành công",
    data: doctor,
  });
};

export const updateDoctorAvailabilityHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await DoctorService.updateAvailability(
    getParam(req.params.id),
    req.body.isAvailable,
  );
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Cập nhật trạng thái bác sĩ thành công",
    data: doctor,
  });
};

export const deleteDoctorHandler = async (
  req: Request,
  res: Response,
) => {
  const doctor = await DoctorService.delete(getParam(req.params.id));
  PublicBootstrapService.invalidate();

  return res.json({
    success: true,
    message: "Xóa hồ sơ bác sĩ thành công",
    data: doctor,
  });
};
