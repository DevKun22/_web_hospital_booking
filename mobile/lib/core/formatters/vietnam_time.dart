/// Múi giờ cố định của dịch vụ: Việt Nam (UTC+7, không đổi giờ mùa hè).
///
/// Lịch khám, khung giờ và nội dung thông báo đều theo giờ Việt Nam, nên mọi phép
/// so sánh "hôm nay/hôm qua/vừa xong" dùng cùng múi giờ này thay vì múi giờ của máy.
const vietnamUtcOffset = Duration(hours: 7);

/// Đổi một thời điểm sang "giờ tường" Việt Nam. Kết quả là [DateTime] UTC đã cộng 7
/// giờ: chỉ dùng để đọc năm/tháng/ngày/giờ/phút và so sánh, không dùng để lưu hay gửi.
DateTime toVietnamTime(DateTime value) => value.toUtc().add(vietnamUtcOffset);

DateTime vietnamNow([DateTime? now]) => toVietnamTime(now ?? DateTime.now());

/// Ngày hôm nay ở Việt Nam, 00:00 (giờ tường).
DateTime vietnamToday([DateTime? now]) {
  final current = vietnamNow(now);
  return DateTime.utc(current.year, current.month, current.day);
}

DateTime vietnamDateOf(DateTime value) {
  final local = toVietnamTime(value);
  return DateTime.utc(local.year, local.month, local.day);
}

String _two(int value) => value.toString().padLeft(2, '0');

/// "Vừa xong", "5 phút trước", "09:30", "Hôm qua · 09:30" hoặc "12/11/2026 · 09:30".
String formatRelativeVietnamTime(DateTime value, {DateTime? now}) {
  final at = toVietnamTime(value);
  final current = vietnamNow(now);
  final age = current.difference(at);
  if (!age.isNegative && age < const Duration(minutes: 1)) return 'Vừa xong';
  if (!age.isNegative && age < const Duration(hours: 1)) {
    return '${age.inMinutes} phút trước';
  }
  final time = '${_two(at.hour)}:${_two(at.minute)}';
  final today = vietnamToday(now);
  final day = vietnamDateOf(value);
  if (day == today) return time;
  if (day == today.subtract(const Duration(days: 1))) return 'Hôm qua · $time';
  return '${_two(at.day)}/${_two(at.month)}/${at.year} · $time';
}
