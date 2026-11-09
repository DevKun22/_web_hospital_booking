"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, AUTH_EXPIRED_EVENT } from "@/lib/api";
import type { DashboardUser } from "@/lib/types";

type LoginResult = {
  challengeId: string;
  // Nơi nhận mã OTP đã được máy chủ che bớt (ví dụ nq*******@gmail.com).
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

  const userRef = useRef<DashboardUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Phiên chỉ cần kiểm tra khi bước vào khu đăng nhập/quản trị, không phải ở mỗi lần đổi mục.
  // Gọi lại theo từng đường dẫn làm khung quản trị bị thay bằng màn hình tải sau mỗi lần bấm.
  const needsDashboardSession =
    pathname === "/login" || pathname.startsWith("/dashboard");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!needsDashboardSession) {
        setLoading(false);
        return;
      }

      // Đã có người dùng thì làm mới ngầm, giữ nguyên giao diện đang hiển thị.
      if (!userRef.current) setLoading(true);
      void refreshUser();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [needsDashboardSession, refreshUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setLoading(false);
      router.replace("/login?expired=1");
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
    // Phản hồi xác thực chưa có danh sách quyền (chỉ /auth/dashboard/me có): nạp lại người dùng đầy đủ
    // ngay để sidebar hiện đúng các mục thay vì chỉ "Tổng quan" cho tới khi tải lại trang.
    const fullUser = await refreshUser();
    if (!fullUser) setUser(result.user);
    return result;
  }, [refreshUser]);

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
