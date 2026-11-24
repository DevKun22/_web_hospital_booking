"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PatientLoginDialog } from "@/components/patient/patient-login-dialog";
import { usePatientAuth } from "@/lib/patient-auth";

// Chỉ cho phép quay về trang trong cổng người khám để tránh open redirect.
function readSafeNextPath() {
  if (typeof window === "undefined") return "/tai-khoan";
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return /^\/tai-khoan(\/[\w\-/]*)?$/.test(next) ? next : "/tai-khoan";
}

// Đường dẫn cũ /tai-khoan/dang-nhap (liên kết trong email, chatbot, trang đặt lịch) vẫn dùng được:
// trang chỉ là nền cho popup đăng nhập; đóng popup thì về trang chủ, đăng nhập xong thì vào trang `next`.
export default function PatientLoginPage() {
  const router = useRouter();
  const { user, loading, verifyOtp } = usePatientAuth();
  const [initialEmail, setInitialEmail] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace(readSafeNextPath());
  }, [loading, router, user]);

  // Điền sẵn email khi được chuyển từ trang đặt lịch (?email=...).
  useEffect(() => {
    const presetEmail = new URLSearchParams(window.location.search).get("email");
    if (!presetEmail) return;
    const id = window.setTimeout(() => setInitialEmail(presetEmail.trim().slice(0, 120)), 0);
    return () => window.clearTimeout(id);
  }, []);

  const close = useCallback(() => router.push("/"), [router]);

  return (
    <main className="public-site min-h-screen bg-[var(--public-canvas)]">
      {loading || user ? (
        <p className="flex min-h-screen items-center justify-center gap-3 text-sm font-semibold text-[var(--public-text-soft)]" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--public-primary)]" aria-hidden="true" />
          Đang kiểm tra phiên đăng nhập...
        </p>
      ) : (
        <PatientLoginDialog
          open
          onClose={close}
          verify={verifyOtp}
          initialEmail={initialEmail}
          onSuccess={() => router.replace(readSafeNextPath())}
        />
      )}
    </main>
  );
}
