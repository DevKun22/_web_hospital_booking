import type { RequestHandler } from "express";
import {
  getMedicalFileDownloadConcurrency,
  getMedicalFileUploadConcurrency,
} from "../config/environment.js";
import { AppError } from "../utils/appError.js";
import { ConcurrencySemaphore } from "../utils/concurrency.js";

type LimitOptions = {
  limit: number;
  message: string;
};

export const createConcurrencyLimit = ({
  limit,
  message,
}: LimitOptions): RequestHandler => {
  const semaphore = new ConcurrencySemaphore(limit);

  return (_req, res, next) => {
    const release = semaphore.tryAcquire();
    if (!release) {
      res.setHeader("Retry-After", "1");
      next(new AppError(message, 503, "RESOURCE_BUSY"));
      return;
    }

    // finish và close có thể cùng phát; permit là idempotent để không release hai lần.
    res.once("finish", release);
    res.once("close", release);
    next();
  };
};

export const limitMedicalFileUpload = createConcurrencyLimit({
  limit: getMedicalFileUploadConcurrency(),
  message: "Hệ thống đang xử lý nhiều tệp, vui lòng thử lại sau",
});

export const limitMedicalFileDownload = createConcurrencyLimit({
  limit: getMedicalFileDownloadConcurrency(),
  message: "Hệ thống đang phục vụ nhiều tệp, vui lòng thử lại sau",
});
