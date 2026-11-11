import { Redis } from "ioredis";
import {
  getCacheRedisConnectionOptions,
  hasCacheRedisUrl,
} from "../config/redis.js";

const RBAC_INVALIDATION_CHANNEL = "rbac:matrix:invalidated";
const RETRY_DELAY_MS = 60_000;

let subscriber: Redis | null = null;
let publisher: Redis | null = null;
let subscriberStart: Promise<void> | null = null;
let retryAfter = 0;
let lastWarningAt = 0;

const warnDegraded = (error: unknown) => {
  const now = Date.now();
  if (now - lastWarningAt < RETRY_DELAY_MS) return;
  lastWarningAt = now;
  console.warn(
    `[RBAC] Cross-instance invalidation unavailable; local cache TTL remains active: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
};

const createClient = (name: string) =>
  new Redis({
    ...getCacheRedisConnectionOptions(),
    connectionName: name,
    lazyConnect: true,
    enableOfflineQueue: true,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt <= 2 ? attempt * 200 : null),
  });

export const ensureRbacInvalidationSubscriber = (
  invalidateLocalCache: () => void,
) => {
  if (!hasCacheRedisUrl() || subscriber || subscriberStart || Date.now() < retryAfter) return;

  const client = createClient("rbac-invalidation-subscriber");
  client.on("message", (channel) => {
    if (channel === RBAC_INVALIDATION_CHANNEL) invalidateLocalCache();
  });
  client.on("error", warnDegraded);
  client.on("end", () => {
    if (subscriber !== client) return;
    subscriber = null;
    retryAfter = Date.now() + RETRY_DELAY_MS;
  });
  subscriber = client;

  subscriberStart = client
    .subscribe(RBAC_INVALIDATION_CHANNEL)
    .then(() => undefined)
    .catch((error: unknown) => {
      client.disconnect();
      if (subscriber === client) subscriber = null;
      retryAfter = Date.now() + RETRY_DELAY_MS;
      warnDegraded(error);
    })
    .finally(() => {
      subscriberStart = null;
    });
};

export const publishRbacInvalidation = async () => {
  if (!hasCacheRedisUrl()) return;

  try {
    publisher ||= createClient("rbac-invalidation-publisher");
    await publisher.publish(RBAC_INVALIDATION_CHANNEL, Date.now().toString());
  } catch (error) {
    publisher?.disconnect();
    publisher = null;
    warnDegraded(error);
  }
};

export const closeRbacInvalidation = async () => {
  const pendingStart = subscriberStart;
  const clients = [subscriber, publisher].filter((client): client is Redis => Boolean(client));
  subscriber = null;
  publisher = null;
  clients.forEach((client) => client.disconnect());
  await pendingStart?.catch(() => undefined);
};
