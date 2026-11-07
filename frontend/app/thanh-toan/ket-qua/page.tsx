import { ArrowRight, ReceiptText, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";

type PaymentReturnPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function PaymentReturnPage({
  searchParams,
}: PaymentReturnPageProps) {
  const params = await searchParams;
  const orderId = firstValue(params.orderId)?.slice(0, 80);
  // Trạng thái do backend gắn vào sau khi đã xác thực chữ ký cổng thanh toán.
  // Đây chỉ là gợi ý hiển thị; trạng thái chuẩn nằm ở mục Hóa đơn.
  const status = firstValue(params.status);
  const heading =
    status === "success"
      ? "Thanh toán thành công"
      : status === "failed"
        ? "Thanh toán chưa thành công"
        : status === "error"
          ? "Chưa xác nhận được giao dịch"
          : "Đã quay lại từ cổng thanh toán";
  const description =
    status === "success"
      ? "Hóa đơn của bạn đã được ghi nhận thanh toán."
      : status === "failed"
        ? "Giao dịch bị hủy hoặc bị từ chối. Bạn có thể thử lại trong mục Hóa đơn."
        : status === "error"
          ? "Vui lòng kiểm tra lại trạng thái trong mục Hóa đơn sau ít phút."
          : "Hệ thống đang đối soát kết quả trực tiếp với nhà cung cấp.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#dce6ef] bg-white shadow-[0_24px_70px_rgba(15,68,90,0.12)]">
        <div className="bg-gradient-to-br from-[#006c67] to-[#07958c] px-6 py-7 text-white sm:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <ReceiptText className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{heading}</h1>
          <p className="mt-2 text-sm leading-6 text-white/85">
            {description}
          </p>
        </div>

        <div className="space-y-5 px-6 py-7 sm:px-8">
          <div className="flex gap-3 rounded-2xl bg-[#eef8f7] p-4 text-[#174f4c]">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              Chỉ dữ liệu có chữ ký hợp lệ từ cổng thanh toán mới được dùng để
              cập nhật hóa đơn. Trạng thái chính xác luôn hiển thị trong mục
              Hóa đơn của tài khoản.
            </p>
          </div>

          {orderId ? (
            <p className="text-sm text-[#627183]">
              Mã tham chiếu: <strong className="text-[#172033]">{orderId}</strong>
            </p>
          ) : null}

          <div className="grid gap-3">
            <a
              href="hospitalbooking://app/invoices"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#007b73] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#00635d]"
            >
              <Smartphone className="h-5 w-5" />
              Quay lại ứng dụng
            </a>
            <Link
              href="/tai-khoan/hoa-don"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#cbd8e3] px-4 py-3 text-sm font-semibold text-[#27445c] transition hover:bg-[#f7fafc]"
            >
              Kiểm tra trên website
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-center text-xs leading-5 text-[#788697]">
            Nếu trạng thái chưa đổi ngay, vui lòng chờ vài giây rồi làm mới hóa
            đơn. Không thanh toán lại khi giao dịch vẫn đang chờ xác nhận.
          </p>
        </div>
      </section>
    </main>
  );
}
