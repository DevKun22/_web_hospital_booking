const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const trimmed = (value: string | undefined) => value?.trim() || undefined;
const durationDays = (value: string | undefined, fallback: number) => {
  const match = (value || "").trim().match(/^(\d+)\s*d?$/i);
  return match ? Number(match[1]) : fallback;
};
const nonNegativeInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

// Cấu hình runtime không được cache để test và script có thể truyền env cô lập.
// Mọi parsing/default của biến môi trường dùng trong application nằm tại đây;
// service/controller chỉ nhận giá trị đã có kiểu rõ ràng.
export const getRuntimeConfig = (env: NodeJS.ProcessEnv = process.env) => {
  const frontendUrls =
    trimmed(env.FRONTEND_URLS) || trimmed(env.FRONTEND_URL) || undefined;
  const frontendUrl = frontendUrls?.split(",")[0]?.trim() || "http://localhost:3000";

  return {
    server: {
      port: positiveInteger(env.PORT, 4000),
      frontendUrls,
    },
    database: {
      url: trimmed(env.DATABASE_URL),
    },
    cloudinary: {
      url: trimmed(env.CLOUDINARY_URL),
    },
    firebase: {
      serviceAccountBase64: trimmed(env.FIREBASE_SERVICE_ACCOUNT_BASE64),
      projectId: trimmed(env.FIREBASE_PROJECT_ID),
      applicationCredentials: trimmed(env.GOOGLE_APPLICATION_CREDENTIALS),
    },
    dashboardAuth: {
      cookieSameSite: (trimmed(env.DASHBOARD_COOKIE_SAME_SITE) || "").toLowerCase(),
      refreshTokenDays: durationDays(env.DASHBOARD_REFRESH_TOKEN_DAYS, 7),
      accessCookieMaxAgeSeconds: positiveInteger(
        env.DASHBOARD_ACCESS_COOKIE_MAX_AGE_SECONDS,
        15 * 60,
      ),
      accessTokenExpiresIn: trimmed(env.DASHBOARD_ACCESS_TOKEN_EXPIRES_IN) || "15m",
    },
    bullmq: {
      drainDelaySeconds: Math.max(positiveInteger(env.BULLMQ_DRAIN_DELAY_SECONDS, 60), 5),
      stalledIntervalMs: positiveInteger(env.BULLMQ_STALLED_INTERVAL_MS, 300_000),
    },
    patientSession: {
      webSessionHours: positiveInteger(env.PATIENT_WEB_SESSION_HOURS, 24),
      mobileSessionDays: positiveInteger(env.PATIENT_MOBILE_SESSION_DAYS, 7),
      webIdleMinutes: positiveInteger(env.PATIENT_WEB_IDLE_MINUTES, 30),
      activityTouchMinutes: positiveInteger(
        env.PATIENT_SESSION_ACTIVITY_TOUCH_MINUTES,
        5,
      ),
      accessTokenExpiresIn: trimmed(env.PATIENT_ACCESS_TOKEN_EXPIRES_IN) || "15m",
    },
    otp: {
      smsProvider: (trimmed(env.SMS_PROVIDER) || "").toLowerCase(),
      textbeeApiKey: trimmed(env.TEXTBEE_API_KEY),
      textbeeDeviceId: trimmed(env.TEXTBEE_DEVICE_ID),
      debugEnabled: ["true", "1", "yes", "on"].includes(
        (trimmed(env.OTP_DEBUG_ENABLED) || "").toLowerCase(),
      ),
      demoPhones: (trimmed(env.DEMO_OTP_PHONES) || "")
        .split(",")
        .map((phone) => phone.trim())
        .filter(Boolean),
      resendApiKey: trimmed(env.RESEND_API_KEY),
      enqueueTimeoutMs: positiveInteger(env.OTP_ENQUEUE_TIMEOUT_MS, 1_000),
    },
    workers: {
      inline: trimmed(env.INLINE_WORKERS),
      appointmentLifecycleConcurrency: positiveInteger(
        env.APPOINTMENT_LIFECYCLE_WORKER_CONCURRENCY,
        5,
      ),
      otpConcurrency: positiveInteger(env.OTP_WORKER_CONCURRENCY, 5),
      paymentReconciliationIntervalMs: positiveInteger(
        env.PAYMENT_RECONCILIATION_INTERVAL_MS,
        10 * 60 * 1_000,
      ),
    },
    jwt: {
      secret: trimmed(env.JWT_SECRET) || "",
    },
    payment: {
      resultUrl:
        trimmed(env.PAYMENT_RESULT_URL) || `${frontendUrl}/thanh-toan/ket-qua`,
      vnpayPaymentUrl: trimmed(env.VNPAY_PAYMENT_URL),
      vnpayQueryUrl: trimmed(env.VNPAY_QUERY_URL),
      vnpayEnabled: ["true", "1", "yes", "on"].includes(
        (trimmed(env.PAYMENT_VNPAY_ENABLED) || "").toLowerCase(),
      ),
      vnpayTmnCode: trimmed(env.VNPAY_TMN_CODE),
      vnpayHashSecret: trimmed(env.VNPAY_HASH_SECRET),
      vnpayReturnUrl: trimmed(env.VNPAY_RETURN_URL),
    },
    chatbot: {
      model: trimmed(env.GEMINI_MODEL) || "gemini-2.5-flash",
      aiTimeoutMs: Math.min(
        Math.max(positiveInteger(env.CHATBOT_AI_TIMEOUT_MS, 8_000), 1_000),
        12_000,
      ),
      geminiApiKey: trimmed(env.GEMINI_API_KEY),
      firebaseApiKey: trimmed(env.FIREBASE_API_KEY) || trimmed(env.API_KEY),
      projectId: trimmed(env.FIREBASE_PROJECT_ID) || trimmed(env.PROJECT_ID),
      contextCacheTtlMs: Math.min(
        nonNegativeInteger(env.CHATBOT_CONTEXT_CACHE_TTL_MS, 30_000),
        5 * 60_000,
      ),
      settingsCacheTtlMs: Math.min(
        nonNegativeInteger(env.CHATBOT_SETTINGS_CACHE_TTL_MS, 60_000),
        10 * 60_000,
      ),
    },
    email: {
      resendApiKey: trimmed(env.RESEND_API_KEY),
      from: trimmed(env.RESEND_FROM) || "Hospital Booking <onboarding@resend.dev>",
      brandName: trimmed(env.MAIL_BRAND_NAME) || "Hospital Booking",
    },
    medicalFile: {
      allowedHosts: (trimmed(env.MEDICAL_FILE_ALLOWED_HOSTS) || "res.cloudinary.com")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
      maxBytes: positiveInteger(env.MEDICAL_FILE_MAX_BYTES, 20 * 1024 * 1024),
    },
    sms: {
      baseUrl: (trimmed(env.TEXTBEE_API_URL) || "https://api.textbee.dev").replace(
        /\/$/,
        "",
      ),
      deviceId: trimmed(env.TEXTBEE_DEVICE_ID),
      apiKey: trimmed(env.TEXTBEE_API_KEY),
    },
    publicSearch: {
      cacheTtlMs: Math.min(
        nonNegativeInteger(env.PUBLIC_SEARCH_CACHE_TTL_MS, 30_000),
        5 * 60 * 1_000,
      ),
    },
    demoSeed: {
      resetRequested: env.RESET_DATABASE === "true",
      resetAllowed: env.ALLOW_DATABASE_RESET === "true",
    },
  } as const;
};

export type RuntimeConfig = ReturnType<typeof getRuntimeConfig>;
