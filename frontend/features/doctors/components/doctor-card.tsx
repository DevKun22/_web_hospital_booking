/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Star } from "lucide-react";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { DoctorProfile } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);
const MAX_SLOTS = 6;

// Một bác sĩ trong danh sách: người, chuyên môn, đánh giá, phí, giờ trống hôm nay (bấm vào là đặt ngay).
export function DoctorCard({ doctor, today }: { doctor: DoctorProfile; today: string }) {
  const slots = doctor.todayAvailableSlots || [];
  const reviewCount = doctor.reviewSummary?.count || 0;
  const rating = doctor.reviewSummary?.averageRating || 0;
  const profile = getPublicDoctorPath(doctor);
  const bookingBase = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;

  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {doctor.user.avatar ? (
            <img src={doctor.user.avatar} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)] text-2xl font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">
              {doctorInitial(doctor.user.fullName)}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug"><Link href={profile} className="hover:text-[var(--public-primary)]">{doctorDisplayName(doctor)}</Link></h2>
            <p className="text-sm text-[var(--public-muted)]">{[doctor.department.name, doctor.experience ? `${doctor.experience} năm kinh nghiệm` : ""].filter(Boolean).join(" · ")}</p>
            {doctor.specialization ? <p className="mt-1 line-clamp-2 text-base text-[var(--public-text-soft)]">{doctor.specialization}</p> : null}
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--public-muted)]">
              <Star className={`h-4 w-4 ${reviewCount ? "fill-[var(--public-warning)] text-[var(--public-warning)]" : ""}`} aria-hidden="true" />
              {reviewCount ? `${rating.toFixed(1)} (${reviewCount} đánh giá)` : "Chưa có đánh giá"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
          <p className="text-xs text-[var(--public-muted)] sm:text-right">Phí khám<span className="block text-lg font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</span></p>
          <div className="flex gap-2">
            <Link href={profile} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Hồ sơ</Link>
            <Link href={bookingBase} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Đặt lịch</Link>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--public-divider)] pt-3">
        {slots.length ? (
          <>
            <span className="text-sm text-[var(--public-muted)]">Còn {slots.length} giờ hôm nay:</span>
            {slots.slice(0, MAX_SLOTS).map((slot) => (
              <Link key={slot.id} href={`${bookingBase}&date=${today}&timeSlotId=${slot.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold tabular-nums hover:border-[var(--public-primary)]">
                {formatTime(slot.startTime)}
              </Link>
            ))}
            {slots.length > MAX_SLOTS ? <Link href={profile} className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem thêm</Link> : null}
          </>
        ) : (
          <Link href={profile} className="text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">Hôm nay hết giờ, xem lịch các ngày khác</Link>
        )}
      </div>
    </li>
  );
}
