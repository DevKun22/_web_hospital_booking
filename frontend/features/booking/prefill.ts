import type { PatientUser } from "@/lib/patient-portal-types";
import type { BookingCatalog, BookingDraft, BookingSelection } from "@/features/booking/model";

// Tự điền từ hồ sơ tài khoản: chỉ điền ô đang trống, không ghi đè điều người dùng đã nhập.
export function buildProfilePrefill(current: BookingDraft, user: PatientUser): Partial<BookingDraft> {
  const profile = user.patientProfile;
  const values: Partial<BookingDraft> = {
    patientName: user.fullName || "",
    patientPhone: user.phone || "",
    patientEmail: user.email || "",
    gender: profile?.gender || "",
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) || "",
    address: profile?.address || "",
    cccd: profile?.cccd || "",
    healthInsuranceCode: profile?.healthInsuranceCode || "",
    registeredHospital: profile?.registeredHospital || "",
    allergies: profile?.allergies || "",
    medicalHistory: profile?.medicalHistory || "",
    familyHistory: profile?.familyHistory || "",
  };
  const patch: Partial<BookingDraft> = {};

  for (const [key, value] of Object.entries(values) as Array<[keyof BookingDraft, BookingDraft[keyof BookingDraft]]>) {
    if (typeof value === "string" && value.trim() && !String(current[key] || "").trim()) {
      Object.assign(patch, { [key]: value });
    }
  }
  if (profile?.hasBHYT && !current.hasBHYT) patch.hasBHYT = true;
  return patch;
}

export type UrlPrefill = Partial<BookingSelection> & Partial<Pick<BookingDraft, "date" | "timeSlotId">>;

const dateOnly = (value?: string | null) => value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";

// Đọc ?doctorId=&packageId=&departmentId=&date=&timeSlotId= và chỉ nhận giá trị có trong danh mục.
export function resolveUrlPrefill(params: URLSearchParams, catalog: BookingCatalog): UrlPrefill {
  const doctor = catalog.doctors.find((item) => item.id === params.get("doctorId"));
  const pack = catalog.packages.find((item) => item.id === params.get("packageId"));
  const department = catalog.departments.find((item) => item.id === params.get("departmentId"));

  return {
    departmentId: doctor?.department.id || pack?.department?.id || department?.id || "",
    doctorId: doctor?.id || "",
    packageId: pack?.id || "",
    date: dateOnly(params.get("date")),
    timeSlotId: params.get("timeSlotId") || "",
  };
}
