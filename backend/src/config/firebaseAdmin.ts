import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

const FIREBASE_ADMIN_APP_NAME = "hospital-booking-notifications";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const decodeServiceAccount = (value: string) => {
  let parsed: ServiceAccountJson;
  try {
    parsed = JSON.parse(
      Buffer.from(value.trim(), "base64").toString("utf8"),
    ) as ServiceAccountJson;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON.");
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 is missing project_id, client_email or private_key.",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
};

export const isFirebaseAdminConfigured = (
  env: NodeJS.ProcessEnv = process.env,
) =>
  Boolean(
    env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim() ||
      env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );

export const getFirebaseAdminApp = (): App => {
  const existing = getApps().find(
    (app) => app.name === FIREBASE_ADMIN_APP_NAME,
  );
  if (existing) return existing;

  const encodedServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  const credential = encodedServiceAccount
    ? cert(decodeServiceAccount(encodedServiceAccount))
    : applicationDefault();

  return initializeApp(
    {
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
    },
    FIREBASE_ADMIN_APP_NAME,
  );
};
