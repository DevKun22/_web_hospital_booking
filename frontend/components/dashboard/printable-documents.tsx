"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import type { Invoice, InsuranceRouteType, PaymentMethod, Prescription } from "@/lib/types";

// In đơn thuốc và hóa đơn từ dashboard. Bản in là một khối ẩn trên màn hình, chỉ hiện khi in
// (xem `.print-sheet` trong globals.css); người dùng chọn "Lưu dưới dạng PDF" ở hộp thoại in nếu
// cần tệp PDF. Không có đường tạo PDF thứ hai ở máy chủ.

export function PrintButton({ label = "In" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

const currency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  VNPAY: "VNPay",
  OTHER: "Khác",
};

const routeLabel: Record<InsuranceRouteType, string> = {
  RIGHT_ROUTE: "Đúng tuyến",
  WRONG_ROUTE: "Trái tuyến",
  REFERRAL: "Chuyển tuyến",
  EMERGENCY: "Cấp cứu",
  SERVICE: "Dịch vụ",
};

function Header({ title, code }: { title: string; code: string }) {
  return (
    <header className="print-header">
      <p className="print-org">Bệnh viện</p>
      <h1>{title}</h1>
      <p className="print-code">Mã: {code}</p>
    </header>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="print-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </p>
  );
}

export function PrintablePrescription({ prescription }: { prescription: Prescription }) {
  const doctor = [prescription.doctor.title, prescription.doctor.user.fullName].filter(Boolean).join(" ");
  return (
    <section className="print-sheet" aria-hidden="true">
      <Header title="Đơn thuốc" code={prescription.prescriptionCode} />
      <Row label="Bệnh nhân" value={prescription.patient.fullName} />
      <Row label="Điện thoại" value={prescription.patient.phone} />
      <Row label="Lịch hẹn" value={prescription.appointment.bookingCode} />
      <Row label="Chẩn đoán" value={prescription.medicalRecord.diagnosis} />
      <Row label="Ngày phát hành" value={prescription.issuedAt ? formatVietnamDateTime(prescription.issuedAt) : ""} />

      <table className="print-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Thuốc</th>
            <th>Liều dùng</th>
            <th>Cách dùng</th>
            <th>Số lượng</th>
          </tr>
        </thead>
        <tbody>
          {prescription.items.map((item, index) => (
            <tr key={item.id}>
              <td>{index + 1}</td>
              <td>
                <strong>{item.medicineName}</strong>
              </td>
              <td>{[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "-"}</td>
              <td>{item.instruction || "-"}</td>
              <td>
                {item.quantity ?? "-"} {item.unit || ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {prescription.note ? <p className="print-note">Lời dặn: {prescription.note}</p> : null}
      <footer className="print-signature">
        <p>Bác sĩ kê đơn</p>
        <strong>{doctor}</strong>
      </footer>
    </section>
  );
}

export function PrintableInvoice({ invoice }: { invoice: Invoice }) {
  const doctor = [invoice.appointment.doctor.title, invoice.appointment.doctor.user.fullName].filter(Boolean).join(" ");
  const paid = invoice.status === "PAID" || invoice.status === "REFUNDED";
  const stamp =
    invoice.status === "REFUNDED" ? "ĐÃ HOÀN TIỀN" : invoice.status === "CANCELLED" ? "ĐÃ HỦY" : invoice.status === "UNPAID" ? "CHƯA THANH TOÁN" : "";

  return (
    <section className="print-sheet" aria-hidden="true">
      <Header title={paid ? "Biên nhận thanh toán" : "Hóa đơn khám bệnh"} code={invoice.invoiceCode} />
      {stamp ? <p className="print-stamp">{stamp}</p> : null}
      <Row label="Người khám" value={invoice.patient.fullName} />
      <Row label="Điện thoại" value={invoice.patient.phone} />
      <Row label="Lịch hẹn" value={`${invoice.appointment.bookingCode} · ${formatVietnamDate(invoice.appointment.appointmentDate)} ${invoice.appointment.startTime}`} />
      <Row label="Bác sĩ" value={`${doctor} · ${invoice.appointment.department.name}`} />
      <Row label="Dịch vụ" value={invoice.appointment.package?.name || "Khám bác sĩ"} />

      <table className="print-table">
        <thead>
          <tr>
            <th>Khoản thu</th>
            <th>Số lượng</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.length ? (
            invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{currency(item.unitPrice)}</td>
                <td>{currency(item.amount)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>Hóa đơn cũ chưa có chi tiết khoản thu.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="print-totals">
        <Row label="Tổng chi phí" value={currency(invoice.totalAmount)} />
        <Row label="Giảm trừ BHYT" value={invoice.bhytDiscount > 0 ? `-${currency(invoice.bhytDiscount)}` : currency(0)} />
        <Row label={paid ? "Đã thu" : "Cần thu"} value={currency(invoice.finalAmount)} />
      </div>

      {invoice.bhytDiscount > 0 && invoice.insuranceRouteType ? (
        <p className="print-note">
          BHYT: mức hưởng {invoice.insuranceCoverageRate}% · {routeLabel[invoice.insuranceRouteType]}
        </p>
      ) : null}
      {paid ? (
        <p className="print-note">
          Thanh toán: {invoice.paymentMethod ? paymentLabel[invoice.paymentMethod] : "-"}
          {invoice.paidAt ? ` · ${formatVietnamDateTime(invoice.paidAt)}` : ""}
          {invoice.paymentReference ? ` · Mã tham chiếu ${invoice.paymentReference}` : ""}
        </p>
      ) : null}
      {invoice.status === "REFUNDED" && invoice.refundedAt ? (
        <p className="print-note">Hoàn tiền lúc {formatVietnamDateTime(invoice.refundedAt)}</p>
      ) : null}
      <footer className="print-signature">
        <p>Người lập</p>
      </footer>
    </section>
  );
}
