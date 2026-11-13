"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { ActionBar } from "@/features/booking/components/action-bar";
import { BookingSummary, MobileSummaryLine } from "@/features/booking/components/booking-summary";
import { DetailsStep } from "@/features/booking/components/details-step";
import { ScheduleStep } from "@/features/booking/components/schedule-step";
import { ServiceStep } from "@/features/booking/components/service-step";
import { StepProgress } from "@/features/booking/components/step-progress";
import { SuccessStep } from "@/features/booking/components/success-step";
import { VerifyStep } from "@/features/booking/components/verify-step";
import type { BookingCatalog } from "@/features/booking/model";
import { useBookingFlow } from "@/features/booking/use-booking-flow";

type BookingFlowProps = {
  catalog: BookingCatalog;
  loading: boolean;
  hotline: string;
};

export function BookingFlow({ catalog, loading, hotline }: BookingFlowProps) {
  const flow = useBookingFlow(catalog);
  const { state, slotsError, actions } = flow;
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
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    heading?.focus({ preventScroll: true });
  }, [state.step]);

  const error = state.error || (state.step === "schedule" ? slotsError : "");
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const summary = <MobileSummaryLine flow={flow} />;
  const bar = {
    service: <ActionBar summary={summary} primaryLabel="Tiếp tục" onPrimary={actions.continueFromService} />,
    schedule: <ActionBar summary={summary} onBack={() => actions.goToStep("service")} primaryLabel="Tiếp tục" onPrimary={actions.continueFromSchedule} />,
    details: (
      <ActionBar
        summary={summary}
        onBack={() => actions.goToStep("schedule")}
        primaryLabel="Giữ lịch và gửi mã OTP"
        onPrimary={() => void actions.submitDetails()}
        loading={state.submitting}
      />
    ),
    verify: <ActionBar primaryLabel="Xác nhận" onPrimary={() => void actions.verifyOtp()} loading={state.submitting} />,
    done: null,
  }[state.step];

  return (
    <section id="booking" className="ui-container scroll-mt-24 py-5 sm:py-8">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
        <div className="space-y-4">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--public-ink)]">Đặt lịch khám</h1>
            <div className="mt-3">
              <StepProgress step={state.step} />
            </div>
          </header>

          {error ? (
            <div ref={errorRef} tabIndex={-1} role="alert" className="flex scroll-mt-24 items-start gap-2 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm font-medium text-[var(--public-danger)] focus:outline-none">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
          {state.notice ? (
            <p className="rounded-lg bg-[var(--public-success-soft)] px-3 py-2.5 text-sm font-medium text-[var(--public-success)]" role="status" aria-live="polite">
              {state.notice}
            </p>
          ) : null}

          <div ref={stepRef}>
            {state.step === "service" ? <ServiceStep flow={flow} loading={loading} /> : null}
            {state.step === "schedule" ? <ScheduleStep flow={flow} /> : null}
            {state.step === "details" ? <DetailsStep flow={flow} /> : null}
            {state.step === "verify" ? <VerifyStep flow={flow} /> : null}
            {state.step === "done" ? <SuccessStep flow={flow} /> : null}
          </div>

          {bar}
        </div>

        <BookingSummary flow={flow} hotline={hotline} />
      </div>
    </section>
  );
}
