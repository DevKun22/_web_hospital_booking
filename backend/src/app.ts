import express from "express";
import cors, { type CorsOptions } from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import routes from "./routes/index.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { requestContext } from "./middlewares/requestContext.middleware.js";
import { protectDashboardCookieRequest } from "./middlewares/dashboardCsrf.middleware.js";
import {
  getSafeRequestPath,
  requestPerformance,
} from "./observability/requestPerformance.js";

type CreateAppOptions = {
  requestLogging?: boolean;
  slowRequestLogging?: boolean;
  performanceHeaders?: boolean;
  queryMetricsEnabled?: boolean;
  slowRequestThresholdMs?: number;
};

const getAllowedOrigins = (isProduction: boolean) => {
  const defaultFrontendOrigins = isProduction
    ? ""
    : "http://localhost:3000,http://localhost:3001,http://localhost:5173";

  return (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    defaultFrontendOrigins
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const createApp = (options: CreateAppOptions = {}) => {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = getAllowedOrigins(isProduction);
  const requestLogging = options.requestLogging ?? true;
  const slowRequestLogging = options.slowRequestLogging ?? true;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestContext);

  const corsOptions: CorsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error(
        "Nguồn truy cập không được CORS cho phép",
      ) as Error & {
        statusCode?: number;
      };
      error.statusCode = 403;
      callback(error);
    },
  };

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  if (requestLogging) {
    morgan.token("safe-url", (req) =>
      getSafeRequestPath((req as express.Request).originalUrl),
    );
    morgan.token(
      "request-id",
      (req) => (req as express.Request).requestId || "unknown",
    );
    const format = isProduction
      ? ':remote-addr [:date[iso]] requestId=:request-id ":method :safe-url HTTP/:http-version" :status :response-time ms :res[content-length]'
      : ':method :safe-url :status :response-time ms requestId=:request-id';
    app.use(morgan(format));
  }

  if (slowRequestLogging) {
    app.use(
      requestPerformance({
        exposeHeaders: options.performanceHeaders,
        queryMetricsEnabled: options.queryMetricsEnabled,
        slowRequestThresholdMs: options.slowRequestThresholdMs,
      }),
    );
  }

  app.use(cookieParser());
  app.use(protectDashboardCookieRequest);

  app.get("/", (req, res) => {
    res.json({
      status: "Medical Booking API Running...",
      time: new Date().toISOString(),
    });
  });

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      time: new Date().toISOString(),
    });
  });

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorMiddleware);

  return app;
};
