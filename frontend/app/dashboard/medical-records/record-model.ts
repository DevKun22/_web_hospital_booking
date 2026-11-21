import type { DoctorProfile, LabResult, MedicalRecord, MedicalResultStatus } from "@/lib/types";
import type { DsTone } from "@/components/ds";

// Hồ sơ khám: kiểu biểu mẫu, nhãn và dữ liệu gửi đi tách khỏi trang.

export type RecordForm = {
  symptoms: string;
  diagnosis: string;
  treatment: string;
  doctorNotes: string;
  resultPdfUrl: string;
};

export type LabForm = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  conclusion: string;
  fileUrl: string;
};

export const emptyRecordForm: RecordForm = { symptoms: "", diagnosis: "", treatment: "", doctorNotes: "", resultPdfUrl: "" };
export const emptyLabForm: LabForm = { testName: "", resultValue: "", unit: "", referenceRange: "", conclusion: "", fileUrl: "" };

export const statusLabel: Record<MedicalResultStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
};

export const statusTone: Record<MedicalResultStatus, DsTone> = {
  DRAFT: "warn",
  PUBLISHED: "good",
  ARCHIVED: "neutral",
};

export const doctorName = (doctor: DoctorProfile | MedicalRecord["doctor"]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

export const toRecordForm = (record: MedicalRecord): RecordForm => ({
  symptoms: record.symptoms || "",
  diagnosis: record.diagnosis || "",
  treatment: record.treatment || "",
  doctorNotes: record.doctorNotes || "",
  resultPdfUrl: record.resultPdfUrl || "",
});

export const toLabForm = (lab: LabResult): LabForm => ({
  testName: lab.testName,
  resultValue: lab.resultValue || "",
  unit: lab.unit || "",
  referenceRange: lab.referenceRange || "",
  conclusion: lab.conclusion || "",
  fileUrl: lab.fileUrl || "",
});

export const buildRecordPayload = (form: RecordForm) => ({
  symptoms: form.symptoms.trim() || null,
  diagnosis: form.diagnosis.trim() || null,
  treatment: form.treatment.trim() || null,
  doctorNotes: form.doctorNotes.trim() || null,
  resultPdfUrl: form.resultPdfUrl.trim() || null,
});

export const buildLabPayload = (form: LabForm) => ({
  testName: form.testName.trim(),
  resultValue: form.resultValue.trim() || null,
  unit: form.unit.trim() || null,
  referenceRange: form.referenceRange.trim() || null,
  conclusion: form.conclusion.trim() || null,
  fileUrl: form.fileUrl.trim() || null,
});

export const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "DRAFT", label: "Bản nháp" },
  { id: "PUBLISHED", label: "Đã công bố" },
  { id: "ARCHIVED", label: "Đã lưu trữ" },
];

export const textFields: { key: keyof RecordForm; label: string; hint?: string; rows: number; internal?: boolean }[] = [
  { key: "symptoms", label: "Triệu chứng", rows: 3 },
  { key: "diagnosis", label: "Chẩn đoán", rows: 3 },
  { key: "treatment", label: "Hướng điều trị", rows: 3 },
  { key: "doctorNotes", label: "Ghi chú của bác sĩ", hint: "Nội bộ: người khám không nhìn thấy.", rows: 2, internal: true },
];

// Vùng chọn hoặc kéo thả tệp, dùng cho tệp kết quả của hồ sơ và của từng kết quả cận lâm sàng.
