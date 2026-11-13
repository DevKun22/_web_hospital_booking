"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { DayStrip } from "@/features/booking/components/day-strip";
import { groupSlotsByPeriod } from "@/features/booking/dates";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";
import { type PublicSlot, usePublicAvailableSlots } from "@/lib/public-slots-query";
import type { DoctorProfile } from "@/lib/types";
export type { PublicSlot };

type DoctorDetailClientProps = {
  doctor: DoctorProfile;
  initialDate: string;
  initialSlots: PublicSlot[];
};

const formatTime = (value: string) => value.slice(0, 5);
const dateOnly = (value: string) => value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || value;
const formatMonthYear = (value: string) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(value));

export function DoctorDetailClient({ doctor, initialDate, initialSlots }: DoctorDetailClientProps) {
  const [date, setDate] = useState(initialDate);
  const query = usePublicAvailableSlots({ doctorId: doctor.id, date });
  // Ngày đầu tiên dùng khung giờ máy chủ đã tải sẵn để không phải chờ.
  const slots = query.data ?? (date === initialDate ? initialSlots : []);
  const loading = query.isLoading && !slots.length;
  const groups = groupSlotsByPeriod(slots);
  const bookingUrl = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;
  const summary = doctor.reviewSummary;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <article className="min-w-0">
        <header className="flex items-start gap-4">
          {doctor.user.avatar ? (
            <img src={doctor.user.avatar} alt={doctor.user.fullName} decoding="async" fetchPriority="high" className="h-24 w-24 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)] text-4xl font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">{doctorInitial(doctor.user.fullName)}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{doctorDisplayName(doctor)}</h1>
            <p className="mt-1 text-base text-[var(--public-text-soft)]">{doctor.department.name}{doctor.specialization ? ` · ${doctor.specialization}` : ""}</p>
            <p className="mt-0.5 text-sm text-[var(--public-muted)]">{doctor.experience || 0} năm kinh nghiệm</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)} <span className="text-sm font-normal text-[var(--public-muted)]">phí khám</span></p>
          </div>
        </header>

        <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
          <h2 className="text-lg font-bold">Giới thiệu</h2>
          <p className="mt-2 text-base leading-7 text-[var(--public-text-soft)]">
            {doctor.bio || "Bác sĩ đang tiếp nhận lịch khám và tư vấn theo chuyên khoa. Chọn ngày để xem khung giờ còn trống."}
          </p>
        </section>

        {summary?.count ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Đánh giá từ người khám</h2>
              <p className="inline-flex items-center gap-1.5 text-base font-semibold">
                <Star className="h-4 w-4 fill-[var(--public-warning)] text-[var(--public-warning)]" aria-hidden="true" />
                {summary.averageRating.toFixed(1)} <span className="font-normal text-[var(--public-muted)]">({summary.count} đánh giá)</span>
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 divide-x divide-[var(--public-divider)] rounded-lg border border-[var(--public-border)] text-center">
              {([["Bác sĩ", summary.averageDoctorRating], ["Dịch vụ", summary.averageServiceRating], ["Cơ sở vật chất", summary.averageFacilityRating]] as const).map(([label, value]) => (
                <div key={label} className="px-2 py-2.5">
                  <dt className="text-xs text-[var(--public-muted)]">{label}</dt>
                  <dd className="text-lg font-bold tabular-nums">{value.toFixed(1)}</dd>
                </div>
              ))}
            </dl>
            {doctor.publicReviews?.length ? (
              <ul className="mt-3 divide-y divide-[var(--public-divider)]">
                {doctor.publicReviews.map((review) => (
                  <li key={review.id} className="py-3">
                    <p className="text-sm text-[var(--public-muted)]"><strong className="font-semibold tabular-nums text-[var(--public-ink)]">{review.rating.toFixed(1)}</strong> sao · {formatMonthYear(review.createdAt)}</p>
                    {review.comment ? <p className="mt-1 text-base leading-7 text-[var(--public-text-soft)]">{review.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </article>

      <aside aria-label="Đặt lịch với bác sĩ" className="h-fit rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Lịch trống</h2>
        <div className="mt-3">
          <DayStrip today={initialDate} value={date} onChange={setDate} />
        </div>

        <div className="mt-4 min-h-16" aria-live="polite">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[var(--public-muted)]" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Đang tải khung giờ</p>
          ) : query.isError && !slots.length ? (
            <p role="alert" className="text-sm text-[var(--public-danger)]">Không tải được khung giờ. Thử lại sau.</p>
          ) : groups.length ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold text-[var(--public-muted)]">{group.label}</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {group.slots.map((slot) => (
                      <Link key={slot.id} href={`${bookingUrl}&date=${dateOnly(slot.date)}&timeSlotId=${slot.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--public-border)] text-sm font-semibold tabular-nums hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]">
                        {formatTime(slot.startTime)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--public-border)] px-3 py-3 text-sm text-[var(--public-muted)]">Ngày này chưa có khung giờ trống. Chọn ngày khác.</p>
          )}
        </div>

        <Link href={bookingUrl} className="public-button-primary mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg px-4 text-base font-semibold">
          Đặt lịch với bác sĩ này
        </Link>
      </aside>
    </div>
  );
}
