import { redirect } from "next/navigation";

// Tra cứu lịch hẹn đã gộp vào cổng bệnh nhân: đăng nhập bằng OTP theo số điện
// thoại rồi xem lịch hẹn, kết quả, hóa đơn, hủy lịch và đánh giá tại một nơi.
// Giữ URL này để các liên kết cũ, email và chatbot vẫn hoạt động.
export default async function AppointmentLookupRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const phone = typeof params.phone === "string" ? params.phone.replace(/\D/g, "") : "";
  const query = new URLSearchParams({ next: "/tai-khoan/lich-hen" });
  if (/^0\d{9}$/.test(phone)) query.set("phone", phone);
  redirect(`/tai-khoan/dang-nhap?${query.toString()}`);
}
