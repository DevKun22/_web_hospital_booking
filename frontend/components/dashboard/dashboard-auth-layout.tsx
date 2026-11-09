"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardContentSkeleton } from "@/components/dashboard/dashboard-content-skeleton";
import { ForcePasswordChange } from "@/components/dashboard/force-password-change";
import { useAuth } from "@/lib/auth";
import { DsEmptyState, DsPageHeader, DsPanel } from "@/components/ds";
import { canAccessDashboardPath, getDashboardNavItem } from "@/lib/dashboard-navigation";

export function DashboardAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Đã từng có người dùng trong khung này: mất người dùng nghĩa là đăng xuất chủ động (logout tự chuyển
  // hướng) hoặc hết phiên (AuthProvider tự chuyển hướng kèm ?expired=1). Chuyển hướng ở đây nữa sẽ đè
  // mất thông báo hết phiên, nên chỉ chuyển khi vào thẳng mà chưa đăng nhập.
  const hadUserRef = useRef(false);
  useEffect(() => {
    if (user) hadUserRef.current = true;
  }, [user]);

  useEffect(() => {
    if (!loading && !user && !hadUserRef.current) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  // Màn hình toàn trang chỉ dành cho lần vào đầu tiên (chưa biết người dùng). Sau đó khung luôn giữ nguyên.
  if (!user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Đang tải dashboard</span>
        <div className="flex w-full max-w-xs flex-col gap-3 px-6" aria-hidden="true">
          <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--muted)]" />
          <div className="h-8 w-full animate-pulse rounded-lg bg-[var(--muted)]" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  const allowed = canAccessDashboardPath(user, pathname);

  return (
    <DashboardShell>
      {allowed ? children : loading ? <DashboardContentSkeleton /> : <NoAccess pathname={pathname} />}
    </DashboardShell>
  );
}

// Vào thẳng một mục mà tài khoản không được cấp: giữ nguyên địa chỉ và nói rõ lý do, không chuyển hướng lặng lẽ.
function NoAccess({ pathname }: { pathname: string }) {
  const item = getDashboardNavItem(pathname);

  return (
    <>
      <DsPageHeader title={item?.label ?? "Không truy cập được"} />
      <DsPanel>
        <DsEmptyState
          title="Tài khoản của bạn chưa được cấp quyền vào mục này"
          description="Nếu cần dùng mục này, hãy nhờ quản trị viên cấp quyền tương ứng."
          action={
            <Link href="/dashboard" className="ds-btn">
              Về trang chủ
            </Link>
          }
        />
      </DsPanel>
    </>
  );
}
