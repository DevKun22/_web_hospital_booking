import { Request, Response } from "express";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    code: "ROUTE_NOT_FOUND",
    message: `Route ${req.originalUrl} not found`,
    requestId: req.requestId,
    errors: [],
  });
};
