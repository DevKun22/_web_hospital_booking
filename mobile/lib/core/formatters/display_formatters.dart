String formatDateVi(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);
  if (match == null) return value;
  return '${match.group(3)}/${match.group(2)}/${match.group(1)}';
}

String formatTimeRange(String startTime, String endTime) {
  String compact(String value) =>
      value.length >= 5 ? value.substring(0, 5) : value;
  return '${compact(startTime)} – ${compact(endTime)}';
}

String formatVnd(num value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return '${buffer.toString()} đ';
}
