"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, MapPin, Star } from "lucide-react";
import { TrustLine } from "@/components/public/catalog-content";
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

const DAY_LABELS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

// Gom ca mẫu theo thứ, tuần bắt đầu từ Thứ Hai (Chủ nhật đứng cuối).
const groupWeeklySchedule = (schedules: NonNullable<DoctorProfile["schedules"]> | undefined) => {
  const byDay = new Map<number, NonNullable<DoctorProfile["schedules"]>>();
  for (const item of schedules ?? []) byDay.set(item.dayOfWeek, [...(byDay.get(item.dayOfWeek) ?? []), item]);
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((day) => byDay.has(day))
    .map((day) => ({ dayOfWeek: day, label: DAY_LABELS[day], shifts: byDay.get(day)! }));
};
const dateOnly = (value: string) => value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || value;
const formatMonthYear = (value: string) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(value));

export function DoctorDetailClient({ doctor, initialDate, initialSlots }: DoctorDetailClientProps) {
  const [date, setDate] = useState(initialDate);
  const [slotId, setSlotId] = useState<string | null>(null);
  const query = usePublicAvailableSlots({ doctorId: doctor.id, date });
  // Ngày đầu tiên dùng khung giờ máy chủ đã tải sẵn để không phải chờ.
  const slots = query.data ?? (date === initialDate ? initialSlots : []);
  const loading = query.isLoading && !slots.length;
  const groups = groupSlotsByPeriod(slots);
  const bookingUrl = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;
  const selectedSlot = slots.find((slot) => slot.id === slotId);
  // Chọn giờ rồi mới bấm Đặt lịch: giờ đã chọn được mang sang bước đặt, người khám vẫn đổi được sang giờ hoặc ngày khác.
  const bookingHref = selectedSlot ? `${bookingUrl}&date=${dateOnly(selectedSlot.date)}&timeSlotId=${selectedSlot.id}` : bookingUrl;
  const summary = doctor.reviewSummary;
  const weeklySchedule = groupWeeklySchedule(doctor.schedules);
  // Chỉ nêu tên cơ sở khi bác sĩ khám ở từ hai cơ sở trở lên.
  const facilities = Array.from(new Map((doctor.schedules ?? []).flatMap((item) => (item.facility ? [[item.facility.id, item.facility] as const] : []))).values());
  const showFacilities = new Set((doctor.schedules ?? []).map((item) => item.facility?.id ?? "")).size > 1;

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
            <TrustLine updatedAt={doctor.profileUpdatedAt} reviewerName={doctor.profileReviewerName} subject="Hồ sơ" />
            <p className="mt-2 text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)} <span className="text-sm font-normal text-[var(--public-muted)]">phí khám</span></p>
          </div>
        </header>

        {doctor.motto ? (
          <blockquote className="mt-6 border-l-4 border-[var(--public-primary)] bg-[var(--public-primary-soft)] px-4 py-3 text-base text-[var(--public-ink)]">
            <p className="text-sm font-semibold text-[var(--public-muted)]">Tâm niệm nghề nghiệp</p>
            <p className="mt-1">{doctor.motto}</p>
          </blockquote>
        ) : null}

        <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
          <h2 className="text-xl font-bold">Giới thiệu</h2>
          <p className="mt-2 text-base leading-7 text-[var(--public-text-soft)]">
            {doctor.bio || "Bác sĩ đang tiếp nhận lịch khám và tư vấn theo chuyên khoa. Chọn ngày để xem khung giờ còn trống."}
          </p>
        </section>

        {weeklySchedule.length ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <h2 className="text-xl font-bold">Lịch khám theo tuần</h2>
            <p className="mt-1 text-sm text-[var(--public-muted)]">Giờ làm việc thường lệ; khung giờ còn trống từng ngày xem ở mục Lịch trống.</p>
            <dl className="mt-3 divide-y divide-[var(--public-divider)] rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
              {weeklySchedule.map((day) => (
                <div key={day.dayOfWeek} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
                  <dt className="font-semibold">{day.label}</dt>
                  <dd className="tabular-nums text-[var(--public-text-soft)]">
                    {day.shifts.map((shift) => (
                      <span key={`${shift.startTime}-${shift.endTime}`} className="block">
                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        {showFacilities && shift.facility ? <span className="text-[var(--public-muted)]"> · {shift.facility.name}</span> : null}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {facilities.length ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <h2 className="text-xl font-bold">Cơ sở khám</h2>
            <ul className="mt-3 space-y-2">
              {facilities.map((facility) => (
                <li key={facility.id} className="flex items-start gap-3 text-base">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                  <span><span className="block font-semibold">{facility.name}</span><span className="block text-sm text-[var(--public-muted)]">{facility.address}</span></span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {doctor.expertise?.length ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <h2 className="text-xl font-bold">Lĩnh vực chuyên sâu</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {doctor.expertise.map((item) => (
                <li key={item} className="rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 py-1.5 text-sm">{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {doctor.careerTimeline?.length ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <h2 className="text-xl font-bold">Quá trình công tác</h2>
            <ol className="mt-3 space-y-3">
              {doctor.careerTimeline.map((entry, index) => (
                <li key={`${entry.period}-${index}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-base">
                  <span className="text-sm font-semibold tabular-nums text-[var(--public-muted)]">{entry.period}</span>
                  <span>
                    <span className="block font-semibold">{entry.place}</span>
                    {entry.role ? <span className="block text-sm text-[var(--public-muted)]">{entry.role}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {doctor.memberships?.length ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <h2 className="text-xl font-bold">Hiệp hội chuyên môn</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-[var(--public-text-soft)]">
              {doctor.memberships.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary?.count ? (
          <section className="mt-6 border-t border-[var(--public-divider)] pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">Đánh giá từ người khám</h2>
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

      <aside id="lich-trong" aria-label="Đặt lịch với bác sĩ" className="h-fit rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold">Lịch trống</h2>
        <div className="mt-3">
          <DayStrip today={initialDate} value={date} onChange={(next) => { setDate(next); setSlotId(null); }} />
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
                      <button
                        key={slot.id}
                        type="button"
                        aria-pressed={slot.id === slotId}
                        onClick={() => setSlotId(slot.id === slotId ? null : slot.id)}
                        className={`relative inline-flex min-h-11 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] ${slot.id === slotId ? "border-[var(--public-solid)] bg-[var(--public-solid)] text-[var(--public-on-solid)]" : "border-[var(--public-border)] hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]"}`}
                      >
                        {slot.id === slotId ? <Check className="absolute left-2 h-4 w-4" aria-hidden="true" /> : null}
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--public-border)] px-3 py-3 text-sm text-[var(--public-muted)]">Ngày này chưa có khung giờ trống. Chọn ngày khác.</p>
          )}
        </div>

        {selectedSlot ? <p className="mt-4 text-sm text-[var(--public-text-soft)]">Đã chọn <strong className="font-semibold tabular-nums text-[var(--public-ink)]">{formatTime(selectedSlot.startTime)}</strong>. Bấm lại giờ đó để bỏ chọn, hoặc chọn giờ khác.</p> : null}
        <Link href={bookingHref} className={`public-button-primary inline-flex min-h-12 w-full items-center justify-center rounded-lg px-4 text-base font-semibold ${selectedSlot ? "mt-2" : "mt-4"}`}>
          Đặt lịch với bác sĩ này
        </Link>
      </aside>

      {/* Điện thoại: thanh nút cố định dưới màn hình, bấm cuộn tới mục Lịch trống (dùng chung kiểu với trang đặt lịch). */}
      <div className="lg:hidden">
        <div className="booking-action-bar">
          <div className="booking-action-bar__inner">
            <a href="#lich-trong" className="public-button-primary inline-flex min-h-12 flex-1 items-center justify-center rounded-lg px-5 text-base font-semibold">Đặt lịch</a>
          </div>
        </div>
      </div>
    </div>
  );
}
