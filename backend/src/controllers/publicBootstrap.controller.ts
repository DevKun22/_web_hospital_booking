import type { NextFunction, Request, Response } from "express";
import PublicBootstrapService, {
  type PublicBootstrapView,
} from "../services/publicBootstrap.service.js";

const resolveView = (value: unknown): PublicBootstrapView => {
  if (value === "featured" || value === "catalog") return value;
  return "full";
};

export const getPublicBootstrapHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await PublicBootstrapService.get(resolveView(req.query.view));

    res.setHeader(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=240",
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
