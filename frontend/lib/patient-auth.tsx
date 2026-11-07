"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PatientUser } from "@/lib/patient-portal-types";
import { patientSessionQueryKey } from "@/lib/patient-session-client";

type OtpChallenge = {
  challengeId: string;
  channel?: "SMS" | "EMAIL";
  maskedTarget?: string;
  expiresIn: number;
  deliveryStatus?: string;
  debugOtp?: string;
};

type PatientAuthContextValue = {
  user: PatientUser | null;
  loading: boolean;
  requestOtp: (identifier: string) => Promise<OtpChallenge>;
  verifyOtp: (challengeId: string, otp: string) => Promise<PatientUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<PatientUser | null>;
};

const WEB_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WEB_IDLE_WARNING_MS = 2 * 60 * 1000;
const SERVER_ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

const PatientAuthContext = createContext<PatientAuthContextValue | null>(null);

async function patientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "Không thể kết nối máy chủ.");
  }
  return payload.data;
}

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PatientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleResetVersion, setIdleResetVersion] = useState(0);
  const lastServerActivityRef = useRef(0);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await patientFetch<PatientUser>("/api/nguoi-kham/phien");
      setUser(profile);
      lastServerActivityRef.current = Date.now();
      queryClient.setQueryData(patientSessionQueryKey, profile);
      return profile;
    } catch {
      setUser(null);
      queryClient.setQueryData(patientSessionQueryKey, null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshUser(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);

  // identifier là số điện thoại hoặc email.
  const requestOtp = useCallback((identifier: string) =>
    patientFetch<OtpChallenge>("/api/nguoi-kham/auth/request-otp", {
      method: "POST",
      body: JSON.stringify(identifier.includes("@") ? { email: identifier } : { phone: identifier }),
    }), []);

  const verifyOtp = useCallback(async (challengeId: string, otp: string) => {
    const result = await patientFetch<{ user: PatientUser }>("/api/nguoi-kham/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ challengeId, otp }),
    });
    setUser(result.user);
    setIdleWarning(false);
    lastServerActivityRef.current = Date.now();
    queryClient.setQueryData(patientSessionQueryKey, result.user);
    return result.user;
  }, [queryClient]);

  const logout = useCallback(async () => {
    await fetch("/api/nguoi-kham/auth/logout", { method: "POST" });
    setUser(null);
    setIdleWarning(false);
    queryClient.setQueryData(patientSessionQueryKey, null);
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    let warningTimer = 0;
    let logoutTimer = 0;

    const scheduleIdleDeadline = () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
      setIdleWarning(false);
      warningTimer = window.setTimeout(
        () => setIdleWarning(true),
        WEB_IDLE_TIMEOUT_MS - WEB_IDLE_WARNING_MS,
      );
      logoutTimer = window.setTimeout(() => {
        void logout();
      }, WEB_IDLE_TIMEOUT_MS);
    };

    const recordUserActivity = () => {
      scheduleIdleDeadline();
      const now = Date.now();
      if (now - lastServerActivityRef.current >= SERVER_ACTIVITY_TOUCH_MS) {
        lastServerActivityRef.current = now;
        void refreshUser();
      }
    };

    scheduleIdleDeadline();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];
    events.forEach((event) =>
      window.addEventListener(event, recordUserActivity, { passive: true }),
    );

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(logoutTimer);
      events.forEach((event) =>
        window.removeEventListener(event, recordUserActivity),
      );
    };
  }, [idleResetVersion, logout, refreshUser, user]);

  const continueSession = useCallback(async () => {
    setIdleWarning(false);
    const profile = await refreshUser();
    if (profile) setIdleResetVersion((value) => value + 1);
  }, [refreshUser]);

  const value = useMemo(
    () => ({ user, loading, requestOtp, verifyOtp, logout, refreshUser }),
    [loading, logout, refreshUser, requestOtp, user, verifyOtp],
  );

  return (
    <PatientAuthContext.Provider value={value}>
      {children}
      {user && idleWarning ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-session-warning-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <p
              id="patient-session-warning-title"
              className="text-lg font-bold"
            >
              Phiên sắp tự động đăng xuất
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Bạn không thao tác trong một thời gian. Phiên sẽ kết thúc sau
              khoảng 2 phút để bảo vệ thông tin sức khỏe.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
              >
                Đăng xuất ngay
              </button>
              <button
                type="button"
                onClick={() => void continueSession()}
                className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Tiếp tục sử dụng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const value = useContext(PatientAuthContext);
  if (!value) throw new Error("usePatientAuth phải được dùng trong PatientAuthProvider");
  return value;
}

