import { Redis } from "ioredis";
import {
  getCacheRedisConnectionOptions,
  getQueueRedisConnectionOptions,
  hasCacheRedisUrl,
  hasQueueRedisUrl,
  resolveCacheRedisUrl,
  resolveQueueRedisUrl,
} from "../config/redis.js";
import {
  reportRedisAvailable,
  reportRedisUnavailable,
} from "./redisHealth.service.js";

let client: Redis | null = null;
let queueProbeClient: Redis | null = null;

export const getCacheRedisClient = () => {
  if (!hasCacheRedisUrl()) return null;
  if (client) return client;

  client = new Redis(getCacheRedisConnectionOptions());
  client.on("ready", () => reportRedisAvailable("cache", "client"));
  client.on("error", (error) =>
    reportRedisUnavailable("cache", "client", error),
  );
  return client;
};

export const getQueueRedisProbeClient = () => {
  if (!hasQueueRedisUrl()) return null;
  if (resolveQueueRedisUrl() === resolveCacheRedisUrl()) {
    return getCacheRedisClient();
  }
  if (queueProbeClient) return queueProbeClient;

  queueProbeClient = new Redis({
    ...getQueueRedisConnectionOptions(),
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  queueProbeClient.on("ready", () => reportRedisAvailable("queue", "probe"));
  queueProbeClient.on("error", (error) =>
    reportRedisUnavailable("queue", "probe", error),
  );
  return queueProbeClient;
};

export const closeCacheRedis = () => {
  const clients = new Set([client, queueProbeClient]);
  clients.forEach((redis) => redis?.disconnect());
  client = null;
  queueProbeClient = null;
};
