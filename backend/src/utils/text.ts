/**
 * Chuẩn hóa chuỗi tùy chọn của dữ liệu vào: không gửi (undefined) thì giữ nguyên, rỗng hoặc chỉ khoảng trắng thì thành null,
 * còn lại cắt khoảng trắng hai đầu.
 */
export const normalizeOptionalString = (value?: string | null) => (value === undefined ? undefined : value?.trim() || null);
