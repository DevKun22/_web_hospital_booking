// Bắt đầu khám đi thẳng vào hồ sơ khám của ca đó (soạn hồ sơ, kê đơn, kết thúc khám trên cùng một màn).
export const examRecordHref = (bookingCode: string) => `/dashboard/medical-records?recordCode=${encodeURIComponent(bookingCode)}`;
