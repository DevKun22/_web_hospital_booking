/**
 * Mốc cuối để người khám tự hủy lịch: giờ bắt đầu khám (múi giờ Việt Nam) trừ số giờ khóa hủy trong chính sách.
 * Cùng công thức với kiểm tra ở cancelByPatient; khóa hủy bằng 0 thì mốc chính là giờ bắt đầu.
 */
export const cancelDeadlineOf = (
  item: { appointmentDate: Date; startTime: string },
  cutoffHours: number,
): string => {
  const dateOnly = item.appointmentDate.toISOString().slice(0, 10);
  const start = new Date(`${dateOnly}T${item.startTime}:00+07:00`);
  return new Date(start.getTime() - Math.max(cutoffHours, 0) * 3_600_000).toISOString();
};
