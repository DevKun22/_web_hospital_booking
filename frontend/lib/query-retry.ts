// Lỗi 4xx (chưa đăng nhập, không có quyền, không tìm thấy) thử lại cũng không đổi kết quả, chỉ làm chậm thông báo lỗi.
export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) return false;
  return failureCount < 1;
};
