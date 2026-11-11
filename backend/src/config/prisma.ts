import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import {
  getDatabasePoolConnectionTimeoutMs,
  getDatabasePoolIdleTimeoutMs,
  getDatabasePoolSize,
  getDatabaseTransactionMaxWaitMs,
  getDatabaseTransactionTimeoutMs,
  isDatabaseQueryMetricsEnabled,
} from "./environment.js";
import { recordDatabaseQuery } from "../observability/requestPerformance.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

const configuredDatabaseUrl = getRuntimeConfig().database.url;
if (!configuredDatabaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const connectionString = configuredDatabaseUrl;
const configuredSchema =
  new URL(connectionString).searchParams.get("schema")?.trim() || undefined;

if (configuredSchema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(configuredSchema)) {
  throw new Error("DATABASE_URL contains an invalid PostgreSQL schema name");
}

export const databaseSchema = configuredSchema || "public";

export const databasePool = new Pool({
  connectionString,
  max: getDatabasePoolSize(),
  connectionTimeoutMillis: getDatabasePoolConnectionTimeoutMs(),
  idleTimeoutMillis: getDatabasePoolIdleTimeoutMs(),
});

const adapter = new PrismaPg(databasePool, {
  ...(configuredSchema ? { schema: configuredSchema } : {}),
  disposeExternalPool: true,
  onPoolError(error) {
    console.error("[DATABASE_POOL] idle client error:", error);
  },
});
const queryMetricsEnabled = isDatabaseQueryMetricsEnabled();
const prisma = new PrismaClient({
  adapter,
  log: queryMetricsEnabled
    ? [{ emit: "event", level: "query" }]
    : [],
  transactionOptions: {
    maxWait: getDatabaseTransactionMaxWaitMs(),
    timeout: getDatabaseTransactionTimeoutMs(),
  },
});

if (queryMetricsEnabled) {
  prisma.$on("query", (event) => {
    recordDatabaseQuery(event.duration);
  });
}

export const getDatabasePoolSnapshot = () => ({
  max: databasePool.options.max,
  total: databasePool.totalCount,
  idle: databasePool.idleCount,
  waiting: databasePool.waitingCount,
});

export { prisma };
