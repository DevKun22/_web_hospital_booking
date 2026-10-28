import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import {
  getDatabaseTransactionMaxWaitMs,
  getDatabaseTransactionTimeoutMs,
  isDatabaseQueryMetricsEnabled,
} from "./environment.js";
import { recordDatabaseQuery } from "../observability/requestPerformance.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const connectionString = `${process.env.DATABASE_URL}`;
const configuredSchema =
  new URL(connectionString).searchParams.get("schema")?.trim() || undefined;

if (configuredSchema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(configuredSchema)) {
  throw new Error("DATABASE_URL contains an invalid PostgreSQL schema name");
}

export const databaseSchema = configuredSchema || "public";

const adapter = new PrismaPg(
  { connectionString },
  configuredSchema ? { schema: configuredSchema } : undefined,
);
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

export { prisma };
