/// Định dạng ngày giờ dùng chung cho luồng đặt lịch.
List<DateTime> nextVietnamDates(int count) {
  final vietnamNow = DateTime.now().toUtc().add(const Duration(hours: 7));
  final today = DateTime(vietnamNow.year, vietnamNow.month, vietnamNow.day);
  return List.generate(count, (index) => today.add(Duration(days: index)));
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
