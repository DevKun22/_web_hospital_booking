const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const readPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const patientSessionPolicy = {
  webAbsoluteMs:
    readPositiveInteger(process.env.PATIENT_WEB_SESSION_HOURS, 24) * HOUR_MS,
  mobileAbsoluteMs:
    readPositiveInteger(process.env.PATIENT_MOBILE_SESSION_DAYS, 7) * DAY_MS,
  webIdleMs:
    readPositiveInteger(process.env.PATIENT_WEB_IDLE_MINUTES, 30) * MINUTE_MS,
  activityTouchMs:
    readPositiveInteger(
      process.env.PATIENT_SESSION_ACTIVITY_TOUCH_MINUTES,
      5,
    ) * MINUTE_MS,
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
