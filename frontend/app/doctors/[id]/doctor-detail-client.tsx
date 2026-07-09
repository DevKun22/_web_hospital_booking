"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, CalendarDays, Clock, Loader2, Star, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { type PublicSlot, usePublicAvailableSlots } from "@/lib/public-booking-query";
import type { DoctorProfile } from "@/lib/types";

export type { PublicSlot };

type DoctorDetailClientProps = {
  doctor: DoctorProfile;
  initialDate: string;
  initialSlots: PublicSlot[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const doctorName = (doctor: DoctorProfile) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");
const firstLetter = (value: string) => value.trim().slice(0, 1).toUpperCase() || "B";
const formatTime = (value: string) => value.slice(0, 5);
const toDateInputValue = (value: string) => value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || value;
const formatReviewDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(value));

export function DoctorDetailClient({ doctor, initialDate, initialSlots }: DoctorDetailClientProps) {
  const [slots, setSlots] = useState<PublicSlot[]>(initialSlots);
  const [date, setDate] = useState(initialDate);
  const [slotError, setSlotError] = useState("");
  const bookingUrl = `/?departmentId=${doctor.department.id}&doctorId=${doctor.id}#booking`;
  const slotsQuery = usePublicAvailableSlots({ doctorId: doctor.id, date });
  const loadingSlots = slotsQuery.isLoading || (slotsQuery.isFetching && !slots.length);

  useEffect(() => {
    if (!slotsQuery.data) return;
    const timeoutId = window.setTimeout(() => {
      setSlots(slotsQuery.data);
      setSlotError("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [slotsQuery.data]);

  useEffect(() => {
    if (!slotsQuery.error) return;
    const timeoutId = window.setTimeout(() => {
      setSlots([]);
      setSlotError(slotsQuery.error instanceof Error ? slotsQuery.error.message : "Không tải được khung giờ khám");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [slotsQuery.error]);
  const getSlotBookingUrl = (slot: PublicSlot) =>
    `/?departmentId=${doctor.department.id}&doctorId=${doctor.id}&date=${toDateInputValue(slot.date)}&timeSlotId=${slot.id}#booking`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <article className="rounded-xl border border-[#cfe0f3] bg-white/95 p-5 shadow-[0_18px_48px_rgba(13,79,139,0.10)] ring-1 ring-[#e7f0fb] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {doctor.user.avatar ? (
            <img src={doctor.user.avatar} alt={doctor.user.fullName} decoding="async" fetchPriority="high" className="h-36 w-36 rounded-lg border border-[#d8e9ff] object-cover shadow-sm" />
          ) : (
            <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-lg border border-[#d8e9ff] bg-[#e7f0fb] text-5xl font-semibold text-[#0d4f8b] shadow-sm">
              {firstLetter(doctor.user.fullName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#667892]">{doctor.department.name}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{doctorName(doctor)}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#667892]">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#d8e9ff] bg-[#f8fbff] px-3 py-2">
                <Stethoscope className="h-4 w-4 text-[#0d4f8b]" />
                {doctor.specialization || "Khám chuyên khoa"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-[#d8e9ff] bg-[#f8fbff] px-3 py-2">
                <Clock className="h-4 w-4 text-[#0d4f8b]" />
                {doctor.experience || 0} năm kinh nghiệm
              </span>
            </div>
            <p className="mt-5 text-2xl font-semibold text-[#0d4f8b]">{formatCurrency(doctor.consultationFee)}</p>
          </div>
        </div>

        <div className="mt-6 border-t border-[#e5ebf3] pt-5">
          <h2 className="text-lg font-semibold">Giới thiệu</h2>
          <p className="mt-3 text-sm leading-7 text-[#667892]">
            {doctor.bio || "Bác sĩ đang tiếp nhận lịch khám và tư vấn theo chuyên khoa. Bạn có thể chọn ngày để xem khung giờ trống trước khi đặt lịch."}
          </p>
        </div>

        {doctor.reviewSummary?.count ? (
          <section className="mt-6 border-t border-[#e5ebf3] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Đánh giá từ người bệnh</h2>
                <p className="mt-1 text-sm text-[#667892]">Các phản hồi đã được bệnh viện xác nhận.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-[#fff8eb] px-3 py-2 text-[#8a5a00]">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold">{doctor.reviewSummary.averageRating.toFixed(1)}/5</span>
                <span className="text-sm">({doctor.reviewSummary.count})</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Bác sĩ", doctor.reviewSummary.averageDoctorRating],
                ["Dịch vụ", doctor.reviewSummary.averageServiceRating],
                ["Cơ sở vật chất", doctor.reviewSummary.averageFacilityRating],
              ].map(([label, value]) => <div key={label as string} className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] px-3 py-2"><p className="text-xs text-[#667892]">{label as string}</p><p className="mt-1 text-sm font-semibold text-[#172033]">{Number(value).toFixed(1)} / 5</p></div>)}
            </div>
            {doctor.publicReviews?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{doctor.publicReviews.map((review) => <article key={review.id} className="rounded-md border border-[#e5ebf3] bg-white p-4"><div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-sm font-semibold text-[#8a5a00]"><Star className="h-4 w-4 fill-current" /> {review.rating.toFixed(1)}</span><span className="text-xs text-[#667892]">Người bệnh · {formatReviewDate(review.createdAt)}</span></div><p className="mt-3 text-sm leading-6 text-[#42526b]">{review.comment}</p></article>)}</div> : null}
          </section>
        ) : null}
      </article>

      <aside className="h-fit rounded-xl border border-[#cfe0f3] bg-white/95 p-5 shadow-[0_18px_48px_rgba(13,79,139,0.08)] ring-1 ring-[#e7f0fb] lg:sticky lg:top-24">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
          <CalendarDays className="h-4 w-4 text-[#0d4f8b]" />
          Lịch trống theo ngày
        </div>
        <VietnamDateInput
          min={initialDate}
          value={date}
          onChange={(value) => {
            setDate(value);
            setSlotError("");
          }}
          ariaLabel="Ngày khám"
          className="ui-field mt-4 w-full px-3 py-2.5 text-sm"
        />

        {slotError ? <div className="mt-3 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm text-[#b3261e]">{slotError}</div> : null}

        <div className="mt-4 min-h-20 space-y-2">
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-[#667892]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải khung giờ
            </div>
          ) : slots.length ? slots.map((slot) => (
            <Link
              key={slot.id}
              href={getSlotBookingUrl(slot)}
              className="flex items-center justify-between rounded-lg border border-[#cfd8e6] bg-white px-3 py-2.5 text-sm font-semibold text-[#42526b] transition hover:-translate-y-0.5 hover:border-[#0d4f8b] hover:bg-[#f8fbff] hover:text-[#0d4f8b]"
            >
              <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
              <span className="inline-flex items-center gap-1 text-[#0d4f8b]">Chọn <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          )) : (
            <div className="rounded-md border border-dashed border-[#dce3ee] px-3 py-4 text-sm text-[#667892]">
              Chưa có khung giờ trống trong ngày này.
            </div>
          )}
        </div>

        <Link href={bookingUrl} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(13,79,139,0.22)] transition hover:-translate-y-0.5 hover:bg-[#083d6d]">
          Đặt lịch với bác sĩ này
          <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  );
}
