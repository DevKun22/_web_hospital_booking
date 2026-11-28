import 'package:hospital_booking_mobile/core/network/json_readers.dart';

// Phần phụ của phản hồi Kun: các lựa chọn đang giữ trong bản nháp đặt lịch và thẻ thông tin có cấu trúc.

List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false)
    : const [];

String _formatDate(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  return match == null
      ? value
      : '${match.group(3)}/${match.group(2)}/${match.group(1)}';
}

/// Các lựa chọn đang giữ trong bản nháp đặt lịch, bằng tên người đọc được (máy chủ tra từ mã).
class ChatbotDraftSummary {
  const ChatbotDraftSummary({
    this.departmentName,
    this.packageName,
    this.doctorName,
    this.slotDate,
    this.slotStart,
    this.slotEnd,
    this.date,
  });

  factory ChatbotDraftSummary.fromJson(Map<String, dynamic> json) =>
      ChatbotDraftSummary(
        departmentName: jsonNullableString(jsonMap(json['department'])['name']),
        packageName: jsonNullableString(jsonMap(json['package'])['name']),
        doctorName: jsonNullableString(jsonMap(json['doctor'])['name']),
        slotDate: jsonNullableString(jsonMap(json['slot'])['date']),
        slotStart: jsonNullableString(jsonMap(json['slot'])['startTime']),
        slotEnd: jsonNullableString(jsonMap(json['slot'])['endTime']),
        date: jsonNullableString(json['date']),
      );

  final String? departmentName;
  final String? packageName;
  final String? doctorName;
  final String? slotDate;
  final String? slotStart;
  final String? slotEnd;
  final String? date;

  /// Từng lựa chọn một dòng ngắn, theo thứ tự người đặt lịch đi qua: gói, khoa, bác sĩ, rồi giờ hoặc ngày.
  List<String> get chips {
    final slotDay = slotDate ?? date;
    final slot = slotDate != null && slotStart != null
        ? '${_formatDate(slotDate!)} · $slotStart${slotEnd == null ? '' : '-$slotEnd'}'
        : slotDay == null
        ? null
        : _formatDate(slotDay);
    return [
      packageName,
      departmentName,
      doctorName,
      slot,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).toList();
  }
}

/// Thẻ thông tin có cấu trúc (giá, hạng mục, phí khám) đi kèm câu trả lời về một gói khám hoặc bác sĩ; số liệu lấy từ dữ liệu hiện hành.
class ChatbotFactCard {
  const ChatbotFactCard({
    required this.kind,
    required this.title,
    required this.rows,
    this.note,
  });

  factory ChatbotFactCard.fromJson(Map<String, dynamic> json) =>
      ChatbotFactCard(
        kind: json['kind']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        note: jsonNullableString(json['note']),
        rows: _maps(json['rows'])
            .map(
              (row) => (
                label: row['label']?.toString() ?? '',
                value: row['value']?.toString() ?? '',
              ),
            )
            .where((row) => row.label.isNotEmpty && row.value.isNotEmpty)
            .toList(growable: false),
      );

  /// `package` hoặc `doctor`.
  final String kind;
  final String title;
  final List<({String label, String value})> rows;
  final String? note;
}
