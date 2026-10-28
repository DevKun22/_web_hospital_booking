import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
  getSlowRequestThresholdMs,
  isDatabaseQueryMetricsEnabled,
  isPerformanceHeadersEnabled,
} from "../config/environment.js";

type RequestPerformanceContext = {
  requestId: string;
  startedAt: bigint;
  databaseQueryCount: number;
  databaseDurationMs: number;
};

type RequestPerformanceOptions = {
  exposeHeaders?: boolean;
  queryMetricsEnabled?: boolean;
  slowRequestThresholdMs?: number;
};

const requestPerformanceStorage =
  new AsyncLocalStorage<RequestPerformanceContext>();

export const recordDatabaseQuery = (durationMs: number) => {
  const context = requestPerformanceStorage.getStore();
  if (!context || !Number.isFinite(durationMs) || durationMs < 0) return;

  context.databaseQueryCount += 1;
  context.databaseDurationMs += durationMs;
};

export const runWithRequestPerformance = <T>(
  requestId: string,
  callback: () => T,
) =>
  requestPerformanceStorage.run(
    {
      requestId,
      startedAt: process.hrtime.bigint(),
      databaseQueryCount: 0,
      databaseDurationMs: 0,
    },
    callback,
  );

export const getRequestPerformanceSnapshot = () => {
  const context = requestPerformanceStorage.getStore();
  if (!context) return undefined;

  return {
    requestId: context.requestId,
    durationMs:
      Number(process.hrtime.bigint() - context.startedAt) / 1_000_000,
    databaseQueryCount: context.databaseQueryCount,
    databaseDurationMs: context.databaseDurationMs,
  };
};

const SENSITIVE_PATH_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,}|\d{6,}|[a-z]{2,12}-\d{3,}|[a-z0-9_-]{24,})$/i;

export const getSafeRequestPath = (originalUrl: string) => {
  let pathname = "/unknown";

  try {
    pathname = new URL(originalUrl, "http://local").pathname;
  } catch {
    pathname = originalUrl.split("?", 1)[0] || "/unknown";
  }

  return pathname
    .split("/")
    .map((segment) => (SENSITIVE_PATH_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
};

export const requestPerformance = (
  options: RequestPerformanceOptions = {},
): RequestHandler => {
  const exposeHeaders =
    options.exposeHeaders ?? isPerformanceHeadersEnabled();
  const queryMetricsEnabled =
    options.queryMetricsEnabled ?? isDatabaseQueryMetricsEnabled();
  const slowRequestThresholdMs =
    options.slowRequestThresholdMs ?? getSlowRequestThresholdMs();

  return (req: Request, res: Response, next: NextFunction) => {
    runWithRequestPerformance(req.requestId, () => {
      const originalEnd = res.end.bind(res);
      let finalizedDurationMs: number | undefined;

      res.end = ((...args: Parameters<Response["end"]>) => {
        const snapshot = getRequestPerformanceSnapshot();
        finalizedDurationMs = snapshot?.durationMs;

        if (exposeHeaders && snapshot && !res.headersSent) {
          const timings = [`app;dur=${snapshot.durationMs.toFixed(1)}`];
          if (queryMetricsEnabled) {
            timings.push(`db;dur=${snapshot.databaseDurationMs.toFixed(1)}`);
            res.setHeader(
              "X-Database-Query-Count",
              String(snapshot.databaseQueryCount),
            );
          }
          res.setHeader("Server-Timing", timings.join(", "));
        }

        return originalEnd(...args);
      }) as Response["end"];

      res.once("finish", () => {
        const snapshot = getRequestPerformanceSnapshot();
        const durationMs =
          finalizedDurationMs ?? snapshot?.durationMs ?? Number.NaN;

        if (!Number.isFinite(durationMs) || durationMs < slowRequestThresholdMs) {
          return;
        }

        const databaseMetrics = queryMetricsEnabled && snapshot
          ? ` dbQueries=${snapshot.databaseQueryCount} dbDurationMs=${snapshot.databaseDurationMs.toFixed(1)}`
          : "";

        console.warn(
          `[SLOW_REQUEST] requestId=${req.requestId} method=${req.method} route=${getSafeRequestPath(req.originalUrl)} status=${res.statusCode} durationMs=${durationMs.toFixed(1)}${databaseMetrics}`,
        );
      });

      next();
    });
  };
};
