import { Router } from "express";
import {
  createArticleHandler,
  deleteArticleHandler,
  getDashboardArticleHandler,
  getPublicArticleHandler,
  listDashboardArticlesHandler,
  listPublicArticlesHandler,
  publishArticleHandler,
  unpublishArticleHandler,
  updateArticleHandler,
} from "../controllers/article.controller.js";
import { authDashboard, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createArticleSchema, publishArticleSchema, updateArticleSchema } from "../validations/article.validation.js";

export const publicArticleRouter = Router();
publicArticleRouter.get("/", listPublicArticlesHandler);
publicArticleRouter.get("/:slug", getPublicArticleHandler);

export const dashboardArticleRouter = Router();
dashboardArticleRouter.use(authDashboard);
dashboardArticleRouter.get("/", requirePermission("article.write"), listDashboardArticlesHandler);
dashboardArticleRouter.get("/:id", requirePermission("article.write"), getDashboardArticleHandler);
dashboardArticleRouter.post("/", requirePermission("article.write"), validate(createArticleSchema), createArticleHandler);
// Sửa: người viết sửa bản nháp; bài đã xuất bản chỉ người có quyền xuất bản sửa được (kiểm tra trong dịch vụ).
dashboardArticleRouter.patch("/:id", requirePermission("article.write"), validate(updateArticleSchema), updateArticleHandler);
dashboardArticleRouter.post("/:id/publish", requirePermission("article.publish"), validate(publishArticleSchema), publishArticleHandler);
dashboardArticleRouter.post("/:id/unpublish", requirePermission("article.publish"), unpublishArticleHandler);
dashboardArticleRouter.delete("/:id", requirePermission("article.publish"), deleteArticleHandler);
