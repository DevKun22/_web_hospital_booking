import { ArrowRight, Smartphone } from "lucide-react";
import Link from "next/link";

type PaymentReturnPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const params = await searchParams;
  const orderId = firstValue(params.orderId)?.slice(0, 80);
  // Trạng thái do backend gắn vào sau khi đã xác thực chữ ký cổng thanh toán.
  // Đây chỉ là gợi ý hiển thị; trạng thái chuẩn nằm ở mục Hóa đơn.
  const status = firstValue(params.status);
  const heading =
    status === "success" ? "Thanh toán thành công" : status === "failed" ? "Thanh toán chưa thành công" : status === "error" ? "Chưa xác nhận được giao dịch" : "Đã quay lại từ cổng thanh toán";
  const description =
    status === "success"
      ? "Hóa đơn của bạn đã được ghi nhận thanh toán."
      : status === "failed"
        ? "Giao dịch bị hủy hoặc bị từ chối. Bạn có thể thử lại trong mục Hóa đơn."
        : status === "error"
          ? "Vui lòng kiểm tra lại trạng thái trong mục Hóa đơn sau ít phút."
          : "Hệ thống đang đối soát kết quả trực tiếp với nhà cung cấp.";
  const tone = status === "success" ? "text-[var(--public-success)]" : status === "failed" || status === "error" ? "text-[var(--public-danger)]" : "text-[var(--public-ink)]";

  return (
    <main className="public-site flex min-h-screen items-start justify-center bg-[var(--public-canvas)] px-4 py-10 text-[var(--public-ink)] sm:items-center">
      <section className="w-full max-w-md" aria-live="polite">
        <h1 className={`text-2xl font-bold sm:text-3xl ${tone}`}>{heading}</h1>
        <p className="mt-2 text-base leading-7 text-[var(--public-text-soft)]">{description}</p>

        {orderId ? (
          <p className="mt-4 text-sm text-[var(--public-muted)]">
            Mã tham chiếu: <strong className="font-semibold text-[var(--public-ink)]">{orderId}</strong>
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <Link href="/tai-khoan/hoa-don" className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold">
            Xem hóa đơn trên website
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a href="devkuncare://app/invoices" className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
            Quay lại ứng dụng
          </a>
        </div>

        <p className="mt-6 border-t border-[var(--public-divider)] pt-4 text-sm leading-6 text-[var(--public-muted)]">
          Chỉ dữ liệu có chữ ký hợp lệ từ cổng thanh toán mới cập nhật hóa đơn. Nếu trạng thái chưa đổi, chờ vài giây rồi làm mới hóa đơn và không thanh toán lại khi giao dịch còn chờ xác nhận.
        </p>
      </section>
    </main>
  );
}
