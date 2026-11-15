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

/// `dd/MM/yyyy lúc HH:mm` theo giờ máy.
String formatDateTimeVi(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} lúc ${two(local.hour)}:${two(local.minute)}';
}

/// Chuyên môn của bác sĩ, hoặc `null` khi trống hay chỉ nhắc lại tên chuyên khoa
/// (vd. "tổng quát" và "Khoa tổng quát"), để không hiển thị lặp.
String? distinctSpecialization(String? specialization, String? departmentName) {
  final value = specialization?.trim();
  if (value == null || value.isEmpty) return null;
  String normalize(String text) =>
      text.toLowerCase().replaceFirst(RegExp(r'^khoa\s+'), '').trim();
  if (departmentName != null && normalize(value) == normalize(departmentName)) {
    return null;
  }
  return value;
}
