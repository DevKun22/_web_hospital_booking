import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

/// Định dạng ngày giờ dùng chung cho luồng đặt lịch.
List<DateTime> nextVietnamDates(int count) {
  final today = vietnamToday();
  // Ngày thuần (không múi giờ) để dựng nhãn và chuỗi API yyyy-MM-dd.
  final start = DateTime(today.year, today.month, today.day);
  return List.generate(count, (index) => start.add(Duration(days: index)));
}

String formatApiDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

String weekdayLabel(int weekday) => switch (weekday) {
  DateTime.monday => 'T2',
  DateTime.tuesday => 'T3',
  DateTime.wednesday => 'T4',
  DateTime.thursday => 'T5',
  DateTime.friday => 'T6',
  DateTime.saturday => 'T7',
  _ => 'CN',
};

String shortTime(String value) =>
    value.length >= 5 ? value.substring(0, 5) : value;

String displayDate(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
}
