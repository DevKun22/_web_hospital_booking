type RedisComponent = "cache" | "queue";

type RedisHealth = {
  available: boolean | null;
  changedAt: number | null;
  source: string | null;
};

const health: Record<RedisComponent, RedisHealth> = {
  cache: { available: null, changedAt: null, source: null },
  queue: { available: null, changedAt: null, source: null },
};

export const reportRedisAvailable = (
  component: RedisComponent,
  source: string,
) => {
  const state = health[component];
  if (state.available === false) {
    console.info(`[REDIS_RECOVERED] component=${component} source=${source}`);
  }
  if (state.available !== true) state.changedAt = Date.now();
  state.available = true;
  state.source = source;
};

export const reportRedisUnavailable = (
  component: RedisComponent,
  source: string,
  error: unknown,
) => {
  const state = health[component];
  if (state.available !== false) {
    console.warn(
      `[REDIS_DEGRADED] component=${component} source=${source} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    state.changedAt = Date.now();
  }
  state.available = false;
  state.source = source;
};

export const getRedisHealth = () => ({
  cache: { ...health.cache },
  queue: { ...health.queue },
});
