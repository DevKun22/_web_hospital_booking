import { getRuntimeConfig } from "./runtimeConfig.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const sessionConfig = getRuntimeConfig().patientSession;

export const patientSessionPolicy = {
  webAbsoluteMs:
    sessionConfig.webSessionHours * HOUR_MS,
  mobileAbsoluteMs:
    sessionConfig.mobileSessionDays * DAY_MS,
  webIdleMs:
    sessionConfig.webIdleMinutes * MINUTE_MS,
  activityTouchMs:
    sessionConfig.activityTouchMinutes * MINUTE_MS,
} as const;

export const isPatientWebPlatform = (platform?: string | null) =>
  platform?.trim().toLowerCase() === "web";

const isPatientMobilePlatform = (platform?: string | null) =>
  ["android", "ios", "mobile"].includes(
    platform?.trim().toLowerCase() || "",
  );

export const getPatientAbsoluteExpiry = (
  platform: string | null | undefined,
  startedAt = new Date(),
) =>
  new Date(
    startedAt.getTime() +
      (isPatientMobilePlatform(platform)
        ? patientSessionPolicy.mobileAbsoluteMs
        : patientSessionPolicy.webAbsoluteMs),
  );

export const getEffectivePatientExpiry = (input: {
  platform?: string | null;
  createdAt: Date;
  storedExpiresAt: Date;
}) => {
  const policyExpiry = getPatientAbsoluteExpiry(input.platform, input.createdAt);
  return policyExpiry < input.storedExpiresAt
    ? policyExpiry
    : input.storedExpiresAt;
};
