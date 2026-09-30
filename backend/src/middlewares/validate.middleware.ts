import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ",
        requestId: req.requestId,
        errors,
      });
    }

    req.body = result.data;
    next();
  };
