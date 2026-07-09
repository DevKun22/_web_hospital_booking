import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

export const CHATBOT_RUNTIME_SETTING_KEY = "chatbot_runtime";

export type ChatbotRuntimeSettings = {
  aiEnabled: boolean;
  fallbackEnabled: boolean;
  faqEnabled: boolean;
  model: string;
  maxSuggestedActions: number;
  sessionExpiresDays: number;
};

export const DEFAULT_CHATBOT_RUNTIME_SETTINGS: ChatbotRuntimeSettings = {
  aiEnabled: true,
  fallbackEnabled: true,
  faqEnabled: true,
  model: "gemini-2.5-flash",
  maxSuggestedActions: 3,
  sessionExpiresDays: 7,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readBoolean = (
  value: Record<string, unknown>,
  key: keyof ChatbotRuntimeSettings,
  fallback: boolean,
) => (typeof value[key] === "boolean" ? value[key] : fallback);

const readString = (
  value: Record<string, unknown>,
  key: keyof ChatbotRuntimeSettings,
  fallback: string,
) => (typeof value[key] === "string" && value[key].trim() ? value[key].trim() : fallback);

const readNumber = (
  value: Record<string, unknown>,
  key: keyof ChatbotRuntimeSettings,
  fallback: number,
  options: { min: number; max: number },
) => {
  const raw = value[key];
  const number = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;

  return Math.min(Math.max(Math.trunc(number), options.min), options.max);
};

export const normalizeRuntimeSettings = (value: unknown): ChatbotRuntimeSettings => {
  const source = isObject(value) ? value : {};

  return {
    aiEnabled: readBoolean(source, "aiEnabled", DEFAULT_CHATBOT_RUNTIME_SETTINGS.aiEnabled),
    fallbackEnabled: readBoolean(
      source,
      "fallbackEnabled",
      DEFAULT_CHATBOT_RUNTIME_SETTINGS.fallbackEnabled,
    ),
    faqEnabled: readBoolean(source, "faqEnabled", DEFAULT_CHATBOT_RUNTIME_SETTINGS.faqEnabled),
    model: readString(source, "model", DEFAULT_CHATBOT_RUNTIME_SETTINGS.model),
    maxSuggestedActions: readNumber(
      source,
      "maxSuggestedActions",
      DEFAULT_CHATBOT_RUNTIME_SETTINGS.maxSuggestedActions,
      { min: 1, max: 6 },
    ),
    sessionExpiresDays: readNumber(
      source,
      "sessionExpiresDays",
      DEFAULT_CHATBOT_RUNTIME_SETTINGS.sessionExpiresDays,
      { min: 1, max: 30 },
    ),
  };
};

const toPrismaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

type UpdateRuntimeSettingsInput = Partial<ChatbotRuntimeSettings> & {
  isActive?: boolean;
};

type RuntimeSettingsRecord = {
  id: string;
  key: string;
  value: ChatbotRuntimeSettings;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const rawSettingsCacheTtl = Number(
  process.env.CHATBOT_SETTINGS_CACHE_TTL_MS || 60000,
);
const settingsCacheTtlMs = Number.isFinite(rawSettingsCacheTtl)
  ? Math.min(Math.max(rawSettingsCacheTtl, 0), 10 * 60 * 1000)
  : 60000;

let runtimeSettingsCache: { expiresAt: number; data: RuntimeSettingsRecord } | null = null;

const cloneRuntimeSettings = (setting: RuntimeSettingsRecord): RuntimeSettingsRecord => ({
  ...setting,
  value: { ...setting.value },
});

const readRuntimeSettingsCache = () => {
  if (!settingsCacheTtlMs || !runtimeSettingsCache) return null;
  if (runtimeSettingsCache.expiresAt <= Date.now()) {
    runtimeSettingsCache = null;
    return null;
  }

  return cloneRuntimeSettings(runtimeSettingsCache.data);
};

const writeRuntimeSettingsCache = (setting: RuntimeSettingsRecord) => {
  if (!settingsCacheTtlMs) return;
  runtimeSettingsCache = {
    expiresAt: Date.now() + settingsCacheTtlMs,
    data: cloneRuntimeSettings(setting),
  };
};

const clearRuntimeSettingsCache = () => {
  runtimeSettingsCache = null;
};

class ChatbotSettingsService {
  async getRuntimeSettings() {
    const cached = readRuntimeSettingsCache();
    if (cached) return cached;

    const select = {
      id: true,
      key: true,
      value: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ChatbotSettingSelect;

    const existing = await prisma.chatbotSetting.findUnique({
      where: { key: CHATBOT_RUNTIME_SETTING_KEY },
      select,
    });

    const setting =
      existing ||
      (await prisma.chatbotSetting.create({
        data: {
          key: CHATBOT_RUNTIME_SETTING_KEY,
          value: toPrismaJson(DEFAULT_CHATBOT_RUNTIME_SETTINGS),
          description: "Runtime settings for chatbot AI, FAQ, fallback and session behavior",
          isActive: true,
        },
        select,
      }));

    const normalized = {
      ...setting,
      value: normalizeRuntimeSettings(setting.value),
    };
    writeRuntimeSettingsCache(normalized);
    return normalized;
  }

  async updateRuntimeSettings(input: UpdateRuntimeSettingsInput) {
    const current = await this.getRuntimeSettings();
    const { isActive, ...runtimeInput } = input;
    const nextValue = normalizeRuntimeSettings({
      ...current.value,
      ...runtimeInput,
    });

    const setting = await prisma.chatbotSetting.update({
      where: { key: CHATBOT_RUNTIME_SETTING_KEY },
      data: {
        value: toPrismaJson(nextValue),
        isActive: typeof isActive === "boolean" ? isActive : current.isActive,
      },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const normalized = {
      ...setting,
      value: normalizeRuntimeSettings(setting.value),
    };
    clearRuntimeSettingsCache();
    writeRuntimeSettingsCache(normalized);
    return normalized;
  }
}

export default new ChatbotSettingsService();
