/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Star } from "lucide-react";
import { doctorInitial } from "@/lib/doctor";
import { getVietnamDateInput } from "@/lib/date";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { DoctorProfile } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);

// Thẻ bác sĩ: ảnh chân dung 4:5 (điện thoại: ảnh nhỏ bên trái), học hàm và tên, khoa màu nhấn, số năm kinh nghiệm, đánh giá (chỉ khi có đánh giá công khai),
// giờ trống thật (mỗi giờ là một liên kết vào luồng đặt lịch đã chọn sẵn giờ đó) và hai nút Xem hồ sơ, Đặt sớm nhất (hoặc Đặt lịch khi chưa có giờ). Chỉ hiện thông tin có trong hồ sơ.
export function DoctorCard({ doctor, index = 0 }: { doctor: DoctorProfile; index?: number }) {
  const slots = doctor.todayAvailableSlots || [];
  const total = doctor.todayAvailableSlots?.length || 0;
  const next = doctor.nextAvailableSlot;
  const bookingBase = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;
  const reviews = doctor.reviewSummary;
  const profileHref = getPublicDoctorPath(doctor);
  // Đặt thẳng một giờ: luồng đặt lịch đọc sẵn ngày và giờ từ địa chỉ (chỉ nhận khi có trong danh mục).
  const slotHref = (date: string, slotId: string) => `${bookingBase}&date=${date}&timeSlotId=${slotId}`;
  const today = getVietnamDateInput();
  const primary = slots.length
    ? { href: slotHref(today, slots[0].id), label: `Đặt giờ ${formatTime(slots[0].startTime)}` }
    : next
      ? { href: next.id ? slotHref(next.date.slice(0, 10), next.id) : `${bookingBase}&date=${next.date.slice(0, 10)}`, label: "Đặt sớm nhất" }
      : { href: bookingBase, label: "Đặt lịch" };
  return (
    <li style={{ "--i": index } as React.CSSProperties} className="catalog-rise group flex flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm transition hover:border-[var(--public-primary)] hover:shadow-md motion-reduce:transition-none">
      <div className="flex md:flex-col">
        <Link href={profileHref} tabIndex={-1} aria-hidden="true" className="relative block w-28 shrink-0 self-start overflow-hidden bg-[var(--public-primary-soft)] sm:w-32 md:w-full">
          <div className="aspect-[4/5] md:aspect-[2/1]">
            {doctor.user.avatar ? (
              <img src={doctor.user.avatar} alt="" width={480} height={600} loading="lazy" decoding="async" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,var(--public-primary-soft),var(--public-tint-strong))] text-4xl font-semibold text-[var(--public-primary-dark)]">{doctorInitial(doctor.user.fullName)}</span>
            )}
          </div>
        </Link>
        <div className="min-w-0 flex-1 p-3.5">
          {doctor.title ? <p className="text-sm text-[var(--public-muted)]">{doctor.title}</p> : null}
          <h3 className="text-lg font-semibold leading-snug text-[var(--public-ink)]"><Link href={profileHref} className="hover:text-[var(--public-primary)]">{doctor.user.fullName}</Link></h3>
          <p className="mt-0.5 text-sm font-medium text-[var(--public-primary)]">{doctor.department.name}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--public-muted)]">
            {doctor.experience ? <span>{doctor.experience} năm kinh nghiệm</span> : null}
            {reviews?.count ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[var(--public-warning)] text-[var(--public-warning)]" aria-hidden="true" />
                {reviews.averageRating.toFixed(1)} ({reviews.count} đánh giá)
              </span>
            ) : null}
          </p>
          {slots.length ? (
            <div className="mt-2">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--public-success)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--public-success)]" aria-hidden="true" />Còn {total} giờ hôm nay</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {slots.slice(0, 3).map((slot) => (
                  <Link key={slot.id} href={slotHref(today, slot.id)} className="inline-flex min-h-8 items-center rounded-full border border-[var(--public-border)] px-2.5 text-sm font-medium tabular-nums text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]">{formatTime(slot.startTime)}</Link>
                ))}
                {total > 3 ? <span className="inline-flex min-h-8 items-center px-1 text-sm text-[var(--public-muted)]">+{total - 3}</span> : null}
              </p>
            </div>
          ) : next ? (
            <p className="mt-2 text-sm text-[var(--public-text-soft)]">Gần nhất: <strong className="font-medium tabular-nums">{formatTime(next.startTime)}, {formatShortDate(next.date)}</strong></p>
          ) : null}
          <p className="mt-1.5 text-sm text-[var(--public-muted)]">Phí khám <span className="font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</span></p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 p-3.5 pt-0">
        <Link href={profileHref} className="public-button-secondary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold">Xem hồ sơ</Link>
        <Link href={primary.href} className="public-button-primary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold">{primary.label}</Link>
      </div>
    </li>
  );
}
