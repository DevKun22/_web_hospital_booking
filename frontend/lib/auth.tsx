"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, AUTH_EXPIRED_EVENT } from "@/lib/api";
import type { DashboardUser } from "@/lib/types";

type LoginResult = {
  challengeId: string;
  phone: string;
  email?: string | null;
  otpTarget: string;
  otpChannel: "SMS" | "EMAIL";
  otpDeliveryStatus?: "PENDING" | "SENT" | "FAILED";
  debugOtp?: string;
  expiresAt: string;
  expiresIn: number;
  otpExpiresAt: string;
  otpExpiresIn: number;
};

type VerifyResult = {
  user: DashboardUser;
  redirectPath: string;
};

type AuthContextValue = {
  user: DashboardUser | null;
  loading: boolean;
  refreshUser: () => Promise<DashboardUser | null>;
  login: (phone: string, password: string) => Promise<LoginResult>;
  verifyOtp: (challengeId: string, otp: string) => Promise<VerifyResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await apiRequest<DashboardUser>(
        "/auth/dashboard/me",
        {
          suppressAuthExpired: true,
        },
      );
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const needsDashboardSession =
      pathname === "/login" || pathname.startsWith("/dashboard");

    const timeoutId = window.setTimeout(() => {
      if (!needsDashboardSession) {
        setLoading(false);
        return;
      }

      setLoading(true);
      void refreshUser();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, refreshUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setLoading(false);
      router.replace("/login");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () =>
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [router]);

  const login = useCallback((phone: string, password: string) => {
    return apiRequest<LoginResult>("/auth/dashboard/login", {
      method: "POST",
      body: { phone, password },
    });
  }, []);

  const verifyOtp = useCallback(async (challengeId: string, otp: string) => {
    const result = await apiRequest<VerifyResult>(
      "/auth/dashboard/verify-otp",
      {
        method: "POST",
        body: { challengeId, otp },
      },
    );
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<void>("/auth/dashboard/logout", { method: "POST" }).catch(
      () => undefined,
    );
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, refreshUser, login, verifyOtp, logout }),
    [user, loading, refreshUser, login, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
