import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

/// Nhãn ngắn của lịch khám dùng chung ở danh sách Lịch hẹn và thẻ nhắc ở Trang chủ.

/// Thứ trong tuần: T2 đến T7, CN.
String appointmentWeekday(PatientAppointment item) {
  final date = DateTime.tryParse(item.appointmentDate);
  if (date == null) return '';
  return switch (date.weekday) {
    DateTime.monday => 'T2',
    DateTime.tuesday => 'T3',
    DateTime.wednesday => 'T4',
    DateTime.thursday => 'T5',
    DateTime.friday => 'T6',
    DateTime.saturday => 'T7',
    _ => 'CN',
  };
}

/// Ngày trong tháng, ví dụ "25".
String appointmentDay(PatientAppointment item) {
  final parts = item.appointmentDate.split('-');
  return parts.length >= 3 ? '${int.tryParse(parts[2]) ?? parts[2]}' : '';
}

/// Còn bao lâu đến giờ khám: "Hôm nay", "Ngày mai", "Còn N ngày", "Đang diễn ra".
String appointmentCountdown(PatientAppointment item) {
  final start = item.scheduledStart;
  if (start == null) return '';
  final now = DateTime.now();
  final days = DateTime(
    start.year,
    start.month,
    start.day,
  ).difference(DateTime(now.year, now.month, now.day)).inDays;
  if (days <= 0) return start.isAfter(now) ? 'Hôm nay' : 'Đang diễn ra';
  if (days == 1) return 'Ngày mai';
  return 'Còn $days ngày';
}
