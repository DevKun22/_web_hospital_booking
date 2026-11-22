import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, UserRound } from "lucide-react";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { copyBookingCode } from "@/features/booking/components/copy-code";
import { patientApiRequest } from "@/lib/patient-portal-api";
import { PATIENT_APPOINTMENTS_PATH, patientSessionQueryKey } from "@/lib/patient-session-client";

// Chỉ hiển thị sau khi máy chủ đã xác nhận OTP hợp lệ. Chi tiết lịch (bác sĩ, giờ, nơi khám, phí) đã có ở khung "Lịch hẹn của bạn", không lặp lại ở đây.
export function SuccessStep({ flow }: { flow: BookingFlow }) {
  const { verified } = flow.state;
  const queryClient = useQueryClient();
  if (!verified) return null;
  const signedInEmail = flow.patient?.email;
  const email = flow.state.draft.patientEmail.trim().toLowerCase();
  const detailPath = `${PATIENT_APPOINTMENTS_PATH}/${verified.id}`;
  // Có phiên: vào thẳng chi tiết lịch vừa đặt. Không có phiên: đăng nhập (email điền sẵn) rồi vào đúng lịch đó.
  const primaryHref = signedInEmail ? detailPath : `/tai-khoan/dang-nhap?next=${encodeURIComponent(detailPath)}&email=${encodeURIComponent(email)}`;
  const signOut = async () => {
    await patientApiRequest("/auth/logout", { method: "POST", allowEmpty: true }).catch(() => null);
    queryClient.setQueryData(patientSessionQueryKey, null);
  };

  return (
    <section aria-labelledby="booking-success" className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 sm:p-6" role="status">
      <h2 id="booking-success" tabIndex={-1} className="flex items-start gap-3 text-xl font-bold leading-snug text-[var(--public-ink)] focus:outline-none">
        <svg viewBox="0 0 24 24" className="draw-check mt-0.5 h-7 w-7 shrink-0 text-[var(--public-success)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12.5 2.8 2.8L16 9.5" /></svg>
        Đặt lịch thành công
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">Lịch hẹn đã được xác nhận. Thông tin xác nhận đã gửi tới email {email}.</p>

      <div className="mt-5 rounded-lg border border-[var(--public-border)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">Mã lịch</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="break-all font-mono text-xl font-semibold tracking-wide text-[var(--public-ink)]">{verified.bookingCode}</span>
          <button
            type="button"
            onClick={() => void copyBookingCode(verified.bookingCode, (message) => flow.dispatch({ type: "notice", message }))}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Sao chép
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--public-muted)]">Mã dùng để báo cho cơ sở khám khi cần hỗ trợ.</p>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-[var(--public-primary)] p-4">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--public-ink)]">
          <UserRound className="h-4 w-4 text-[var(--public-primary)]" aria-hidden="true" />
          Theo dõi lịch trong cổng thông tin
          <span className="rounded-full border border-dashed border-[var(--public-primary)] px-2 text-xs font-normal text-[var(--public-primary-dark)]">Không bắt buộc</span>
        </p>
        <p className="mt-1.5 text-sm leading-6 text-[var(--public-text-soft)]">Đăng nhập bằng email đã đặt lịch để xem trạng thái, hủy hoặc đổi lịch. Hóa đơn và thanh toán trực tuyến có sau khi bệnh viện hoàn tất khám.</p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link href={primaryHref} className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-semibold">
          {signedInEmail ? "Xem lịch hẹn của tôi" : "Đăng nhập để xem lịch hẹn"}
        </Link>
        <button type="button" onClick={flow.actions.startNewBooking} className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-semibold">
          Đặt lịch khác
        </button>
      </div>
      {signedInEmail ? (
        <p className="mt-3 text-xs leading-5 text-[var(--public-muted)]">
          Bạn đang đăng nhập bằng {signedInEmail}. Nếu đây không phải thiết bị của bạn, hãy{" "}
          <button type="button" onClick={() => void signOut()} className="font-semibold text-[var(--public-primary)] underline underline-offset-2">
            đăng xuất
          </button>
          .
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--public-muted)]">Đăng nhập bằng email đã đặt lịch, mã OTP sẽ gửi tới email đó.</p>
      )}
    </section>
  );
}
