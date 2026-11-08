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
