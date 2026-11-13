/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Star, Stethoscope } from "lucide-react";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { DoctorProfile } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);

export function DoctorCard({ doctor, today }: { doctor: DoctorProfile; today: string }) {
  const slots = doctor.todayAvailableSlots || [];
  const reviewCount = doctor.reviewSummary?.count || 0;
  const averageRating = doctor.reviewSummary?.averageRating || 0;

  return (
    <article className="public-card flex h-full flex-col overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {doctor.user.avatar ? (
            <img
              src={doctor.user.avatar}
              alt={doctor.user.fullName}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 rounded-xl object-cover ring-2 ring-[var(--public-primary-soft)]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-2xl font-bold text-[var(--public-primary)]">
              {doctorInitial(doctor.user.fullName)}
            </div>
          )}
          <span
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-[var(--public-success)]"
            title="Đang nhận lịch"
            aria-label="Đang nhận lịch"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--public-primary)]">
            {doctor.department.name}
          </p>
          <h2 className="mt-1 line-clamp-2 text-base font-bold leading-5 text-[var(--public-ink)] sm:text-lg">
            <Link
              href={getPublicDoctorPath(doctor)}
              className="hover:text-[var(--public-primary)]"
            >
              {doctorDisplayName(doctor)}
            </Link>
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">
            {doctor.experience || 0} năm kinh nghiệm
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--public-text-soft)]">
            <Star
              className={`h-3.5 w-3.5 ${reviewCount ? "fill-[var(--public-warning)] text-[var(--public-warning)]" : "text-[var(--public-muted)]"}`}
              aria-hidden="true"
            />
            {reviewCount
              ? `${averageRating.toFixed(1)} (${reviewCount} đánh giá)`
              : "Chưa có đánh giá công khai"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--public-primary)]">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
          Chuyên môn
        </p>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--public-text-soft)]">
          {doctor.specialization || "Khám và tư vấn theo chuyên khoa"}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--public-border)] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--public-text-soft)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--public-primary)]"
              aria-hidden="true"
            />
            Giờ trống hôm nay
          </p>
          {slots.length ? (
            <span className="rounded-full bg-[var(--public-success-soft)] px-2 py-1 text-[10px] font-bold text-[var(--public-success)]">
              Còn {slots.length} giờ
            </span>
          ) : null}
        </div>
        {slots.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((slot) => (
              <Link
                key={slot.id}
                href={`/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}&date=${today}&timeSlotId=${slot.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--public-success-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--public-success)] hover:ring-2 hover:ring-[var(--public-success)]/20"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTime(slot.startTime)}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href={getPublicDoctorPath(doctor)}
            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[var(--public-primary)] hover:underline"
          >
            Xem lịch khả dụng theo ngày
            <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-[var(--public-divider)] pt-4">
          <span className="text-xs text-[var(--public-muted)]">Phí khám dự kiến</span>
          <strong className="text-lg tabular-nums text-[var(--public-primary-dark)]">
            {formatCurrency(doctor.consultationFee)}
          </strong>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href={getPublicDoctorPath(doctor)}
            className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-bold sm:text-sm"
          >
            Xem hồ sơ
          </Link>
          <Link
            href={`/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`}
            className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-center text-xs font-bold sm:text-sm"
          >
            Đặt lịch
          </Link>
        </div>
      </div>
    </article>
  );
}
