/// Bộ đọc JSON chịu lỗi dùng chung cho các mô hình lấy từ API.
List<T> decodeJsonList<T>(
  dynamic value,
  T Function(Map<String, dynamic>) decode,
) => value is List
    ? value.whereType<Map>().map((item) => decode(jsonMap(item))).toList()
    : const [];

Map<String, dynamic> jsonMap(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String jsonString(dynamic value) => value?.toString() ?? '';

String? jsonNullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double jsonNumber(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int? jsonNullableInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');

/// Chuỗi đã cắt khoảng trắng; rỗng thì dùng [fallback].
String jsonText(dynamic value, {String fallback = ''}) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? fallback : result;
}

int jsonInt(dynamic value, {int fallback = 0}) => value is num
    ? value.toInt()
    : int.tryParse(value?.toString() ?? '') ?? fallback;

DateTime? jsonDateTime(dynamic value) =>
    DateTime.tryParse(value?.toString() ?? '');

final _datePrefix = RegExp(r'^\d{4}-\d{2}-\d{2}');

/// Phần `yyyy-MM-dd` đầu chuỗi; không khớp thì trả lại chuỗi gốc đã cắt khoảng trắng.
String jsonDateOnly(dynamic value) {
  final raw = jsonText(value);
  return _datePrefix.firstMatch(raw)?.group(0) ?? raw;
}

/// Như [jsonDateOnly] nhưng trả null khi trống hoặc không đúng dạng ngày.
String? jsonNullableDateOnly(dynamic value) {
  final raw = jsonNullableString(value);
  if (raw == null) return null;
  return _datePrefix.firstMatch(raw)?.group(0);
}
