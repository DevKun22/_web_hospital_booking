// Nhận diện tệp y tế theo nội dung thật (chữ ký đầu tệp), không tin loại tệp do client khai báo.
// Chỉ cho phép PDF và ảnh JPEG, PNG, WebP: các định dạng bệnh nhân xem được trên web và mobile.

export type MedicalFileKind = {
  mime: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  extension: "pdf" | "jpg" | "png" | "webp";
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

export const sniffMedicalFile = (buffer: Buffer): MedicalFileKind | null => {
  // PDF: "%PDF-"
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", extension: "pdf" };
  }
  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
};
