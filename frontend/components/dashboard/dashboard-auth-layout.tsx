"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell-production";
import { useAuth } from "@/lib/auth";
import { canAccessDashboardPath } from "@/lib/dashboard-navigation";

export function DashboardAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user && !canAccessDashboardPath(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [loading, pathname, router, user]);

  if (loading || !user || !canAccessDashboardPath(user.role, pathname)) {
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

  return <DashboardShell>{children}</DashboardShell>;
}
