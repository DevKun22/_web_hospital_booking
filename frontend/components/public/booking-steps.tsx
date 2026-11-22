import { CalendarSearch, ClipboardList, Package, ShieldCheck, UserRound } from "lucide-react";

// Hàng năm bước đặt lịch cho trang chi tiết (cùng ngôn ngữ với mục quy trình ở trang chủ nhưng tĩnh): bốn bước bắt buộc và bước Cổng thông tin không bắt buộc.
const STEPS = [
  { title: "Chọn gói", text: "Gói này đã được chuyển sẵn sang trang đặt lịch.", icon: Package },
  { title: "Chọn lịch", text: "Chọn bác sĩ, ngày và khung giờ còn trống.", icon: CalendarSearch },
  { title: "Nhập thông tin", text: "Thông tin người khám và BHYT nếu có.", icon: ClipboardList },
  { title: "Xác thực OTP", text: "Nhập mã gửi về email để hoàn tất.", icon: ShieldCheck },
  { title: "Cổng thông tin", text: "Theo dõi lịch, hóa đơn, hồ sơ. Không bắt buộc.", icon: UserRound, optional: true },
] as const;

export function BookingSteps() {
  return (
    <ol className="mt-4 grid gap-4 sm:grid-cols-5 sm:gap-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const optional = "optional" in step;
        return (
          <li key={step.title} className="relative flex gap-3 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
            {index < STEPS.length - 1 ? <span aria-hidden="true" className="absolute left-[calc(50%+1.5rem)] top-5 hidden h-0.5 w-[calc(100%-2rem)] bg-[var(--public-border)] sm:block" /> : null}
            <span aria-hidden="true" className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${optional ? "border-2 border-dashed border-[var(--public-primary)] bg-[var(--public-canvas)] text-[var(--public-primary)]" : "bg-[var(--public-solid)] text-white"}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 sm:mt-2">
              <p className="text-sm font-semibold text-[var(--public-ink)]"><span className="mr-1 tabular-nums text-[var(--public-primary)]">{index + 1}.</span>{step.title}</p>
              <p className="mt-0.5 text-sm leading-5 text-[var(--public-muted)]">{step.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
