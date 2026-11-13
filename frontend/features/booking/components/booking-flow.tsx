"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, CheckCircle2, Info } from "lucide-react";
import { BookingSummary } from "@/features/booking/components/booking-summary";
import { DetailsStep } from "@/features/booking/components/details-step";
import { ScheduleStep } from "@/features/booking/components/schedule-step";
import { ServiceStep } from "@/features/booking/components/service-step";
import { StepProgress } from "@/features/booking/components/step-progress";
import { SuccessStep } from "@/features/booking/components/success-step";
import { VerifyStep } from "@/features/booking/components/verify-step";
import type { BookingCatalog } from "@/features/booking/model";
import { useBookingFlow } from "@/features/booking/use-booking-flow";
import { ScrollReveal } from "@/components/public/scroll-reveal";

type BookingFlowProps = {
  catalog: BookingCatalog;
  loading: boolean;
  hotline: string;
};

export function BookingFlow({ catalog, loading, hotline }: BookingFlowProps) {
  const flow = useBookingFlow(catalog);
  const { state, slotsError } = flow;
  const stepRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  // Đổi bước thì đưa tiêu đề bước mới vào tầm nhìn và chuyển tiêu điểm cho trình đọc màn hình.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = stepRef.current?.querySelector<HTMLElement>("h2");
    heading?.scrollIntoView({ behavior: "smooth", block: "center" });
    heading?.focus({ preventScroll: true });
  }, [state.step]);

  const error = state.error || (state.step === "schedule" ? slotsError : "");
  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: false });
  }, [error]);

  return (
    <section id="booking" className="ui-container scroll-mt-24 py-8 sm:py-10">
      <ScrollReveal>
        <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--public-primary)]">Phiếu đặt lịch trực tuyến</p>
                <h1 className="mt-1 text-xl font-bold text-[var(--public-ink)] sm:text-2xl">Hoàn tất từng bước để xác nhận lịch</h1>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
                  Hệ thống chỉ hiển thị chuyên khoa, bác sĩ, gói khám và khung giờ đang có trong dữ liệu hiện tại.
                </p>
              </div>
            </div>

            <StepProgress step={state.step} />

            {error ? (
              <div ref={errorRef} tabIndex={-1} role="alert" className="ui-status-danger flex scroll-mt-24 items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
            {state.notice ? (
              <div className="ui-status-positive flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm" role="status" aria-live="polite">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{state.notice}</span>
              </div>
            ) : null}

            <div ref={stepRef}>
              {state.step === "service" ? <ServiceStep flow={flow} loading={loading} /> : null}
              {state.step === "schedule" ? <ScheduleStep flow={flow} /> : null}
              {state.step === "details" ? <DetailsStep flow={flow} loading={loading} /> : null}
              {state.step === "verify" ? <VerifyStep flow={flow} /> : null}
              {state.step === "done" ? <SuccessStep flow={flow} /> : null}
            </div>
          </div>

          <div className="lg:col-span-4">
            <BookingSummary flow={flow} hotline={hotline} />
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
