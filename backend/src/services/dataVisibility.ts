import type { PermissionCode } from "../config/permissions.js";
import { getRolePermissions } from "./rbac.service.js";

// Một nơi duy nhất quyết định "ai được thấy dữ liệu nhúng nào" trong phản hồi của dashboard.
//
// Vì sao cần: quyền được cấp theo từng miền dữ liệu (bệnh án, đơn thuốc, hóa đơn...), nhưng nhiều API nhúng dữ liệu của miền khác
// (hồ sơ khám kèm đơn thuốc, đơn thuốc kèm chẩn đoán, lịch hẹn kèm hóa đơn). Nếu chỉ kiểm quyền ở cửa vào của API chính, người
// không có quyền của miền được nhúng vẫn đọc được qua đường vòng, khiến việc tách quyền vô nghĩa.
//
// Quy tắc (miền được nhúng cần quyền gì để thấy đủ nội dung):
//   hồ sơ khám  -> đơn thuốc ............ prescription.view
//   đơn thuốc   -> chẩn đoán, hướng điều trị của hồ sơ ... record.view
//   lịch hẹn    -> hóa đơn, thanh toán .. invoice.view
//   lịch hẹn    -> dị ứng, tiền sử ...... record.view (đã làm ở appointment.shared.maskClinicalFields)
// Thiếu quyền thì giữ phần tối thiểu để giao diện vẫn hoạt động (ví dụ "đã có hóa đơn") và đánh dấu bằng cờ `...Access: false`.

export type ViewerPermissions = ReadonlySet<PermissionCode>;

export const loadViewerPermissions = async (role: string | undefined): Promise<ViewerPermissions> =>
  new Set(role ? await getRolePermissions(role) : []);

type WithPrescriptions = { prescriptions: unknown[] };

export const redactMedicalRecord = <T extends WithPrescriptions>(record: T, viewer: ViewerPermissions) =>
  viewer.has("prescription.view")
    ? { ...record, prescriptionAccess: true as const }
    : { ...record, prescriptions: [] as T["prescriptions"], prescriptionAccess: false as const };

type WithRecordSummary = { medicalRecord?: { id: string; recordCode: string; status: string; diagnosis?: unknown; treatment?: unknown } | null };

export const redactPrescription = <T extends WithRecordSummary>(prescription: T, viewer: ViewerPermissions) => {
  if (viewer.has("record.view") || !prescription.medicalRecord) return prescription;
  const { id, recordCode, status } = prescription.medicalRecord;
  return { ...prescription, medicalRecord: { id, recordCode, status, diagnosis: null, treatment: null } };
};

type WithInvoice = { invoice?: { id: string; invoiceCode: string; status: string } | null };

// Người không có invoice.view chỉ biết lịch đã có hóa đơn chưa và hóa đơn ở trạng thái nào; không thấy số tiền, cách thanh toán,
// mã tham chiếu, lý do hoàn tiền, danh mục dòng hóa đơn và đường dẫn thanh toán.
export const redactAppointmentBilling = <T extends WithInvoice>(appointment: T, viewer: ViewerPermissions): T =>
  viewer.has("invoice.view") || !appointment.invoice
    ? appointment
    : {
        ...appointment,
        invoice: {
          id: appointment.invoice.id,
          invoiceCode: appointment.invoice.invoiceCode,
          status: appointment.invoice.status,
        } as T["invoice"],
      };
