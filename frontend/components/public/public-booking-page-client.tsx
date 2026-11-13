"use client";

import Link from "next/link";
import {
  CalendarCheck2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { BookingFlow } from "@/features/booking/components/booking-flow";
import { usePublicBootstrap } from "@/lib/public-bootstrap-client";
import type { PublicBootstrapSnapshot } from "@/lib/public-bootstrap";

const bookingJourney = [
  {
    title: "Chọn lịch khám",
    description: "Chọn chuyên khoa, bác sĩ hoặc gói khám và khung giờ còn khả dụng.",
    icon: CalendarCheck2,
  },
  {
    title: "Khai báo thông tin",
    description: "Nhập thông tin liên hệ và bổ sung hồ sơ, BHYT khi cần.",
    icon: FileText,
  },
  {
    title: "Xác thực OTP",
    description: "Dùng mã 6 số được gửi qua kênh bạn đã chọn để xác nhận lịch.",
    icon: ShieldCheck,
  },
  {
    title: "Theo dõi lịch hẹn",
    description: "Lưu mã đặt lịch để tra cứu trạng thái và các thông tin phát sinh.",
    icon: ClipboardCheck,
  },
];

export function PublicBookingPageClient({ snapshot }: { snapshot: PublicBootstrapSnapshot }) {
  const { data: bookingData, loading, error: displayError } = usePublicBootstrap("full", snapshot);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <div className="border-b border-[var(--public-border)] bg-white">
        <nav
          aria-label="Đường dẫn trang"
          className="ui-container flex min-h-10 flex-wrap items-center gap-1.5 py-2 text-xs text-[var(--public-muted)] sm:text-sm"
        >
          <Link
            href="/"
            className="transition hover:text-[var(--public-primary)]"
          >
            Trang chủ
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span
            className="font-semibold text-[var(--public-primary-dark)]"
            aria-current="page"
          >
            Đặt lịch khám
          </span>
        </nav>
      </div>

      {displayError ? (
        <div className="ui-container pt-6">
          <div className="ui-status-danger rounded-xl border px-4 py-3 text-sm" role="alert">{displayError}</div>
        </div>
      ) : null}
      <BookingFlow
        catalog={bookingData}
        loading={loading}
        hotline={bookingData.settings?.hotline?.trim() || bookingData.settings?.emergencyHotline?.trim() || ""}
      />

      <section className="border-y border-[var(--public-border)] bg-[var(--public-primary-soft)]/45 py-14 sm:py-16">
        <div className="ui-container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--public-primary)]">Đơn giản · rõ ràng · có thể tra cứu</p>
            <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">Quy trình đặt lịch 4 bước minh bạch</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--public-muted)] sm:text-base">Các bước dưới đây phản ánh đúng luồng đang được hệ thống hỗ trợ.</p>
          </div>
          <ol className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bookingJourney.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold tabular-nums text-[var(--public-muted)]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 font-bold text-[var(--public-ink)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

    </main>
  );
}
