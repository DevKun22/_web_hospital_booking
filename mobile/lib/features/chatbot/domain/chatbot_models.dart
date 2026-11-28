import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum ChatbotSource { system, faq, ai, fallback, emergency, unknown }

extension ChatbotSourceLabel on ChatbotSource {
  String get label => switch (this) {
    ChatbotSource.system => 'Trợ lý đặt lịch',
    ChatbotSource.faq => 'Câu hỏi thường gặp',
    ChatbotSource.ai => 'AI phân tích · dữ liệu DevKunCare',
    ChatbotSource.fallback => 'Phản hồi dự phòng',
    ChatbotSource.emergency => 'Cảnh báo an toàn',
    ChatbotSource.unknown => 'Trợ lý trả lời',
  };
}

class ChatbotSettings {
  const ChatbotSettings({
    required this.isActive,
    required this.aiEnabled,
    required this.faqEnabled,
    required this.fallbackEnabled,
  });

  factory ChatbotSettings.fromJson(Map<String, dynamic> json) {
    final value = jsonMap(json['value']);
    return ChatbotSettings(
      isActive: json['isActive'] == true,
      aiEnabled: value['aiEnabled'] == true,
      faqEnabled: value['faqEnabled'] == true,
      fallbackEnabled: value['fallbackEnabled'] == true,
    );
  }

  final bool isActive;
  final bool aiEnabled;
  final bool faqEnabled;
  final bool fallbackEnabled;

  bool get isAvailable =>
      isActive && (aiEnabled || faqEnabled || fallbackEnabled);
}

/// Chủ đề Kun vừa nói tới (bác sĩ, khoa, gói) để máy chủ hiểu "bác sĩ này", "gói đó".
class ChatFocus {
  const ChatFocus({
    required this.type,
    required this.id,
    required this.name,
    this.departmentId,
  });

  static ChatFocus? tryParse(dynamic value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final type = json['type']?.toString();
    final id = jsonNullableString(json['id']);
    final name = jsonNullableString(json['name']);
    if (type == null || id == null || name == null) return null;
    if (type != 'doctor' && type != 'department' && type != 'package') {
      return null;
    }
    return ChatFocus(
      type: type,
      id: id,
      name: name,
      departmentId: jsonNullableString(json['departmentId']),
    );
  }

  final String type;
  final String id;
  final String name;
  final String? departmentId;

  Map<String, dynamic> toJson() => {
    'type': type,
    'id': id,
    'name': name,
    if (departmentId != null) 'departmentId': departmentId,
  };
}

class ChatBookingDraft {
  const ChatBookingDraft({
    this.departmentId,
    this.departmentSlug,
    this.packageId,
    this.packageSlug,
    this.serviceMode,
    this.doctorId,
    this.date,
    this.timeSlotId,
    this.symptoms = const [],
    this.bodyParts = const [],
    this.symptomDuration,
    this.symptomSeverity,
    this.associatedSymptoms = const [],
    this.triageLastQuestion,
    this.reason,
    this.focus,
  });

  factory ChatBookingDraft.fromJson(Map<String, dynamic> json) =>
      ChatBookingDraft(
        departmentId: jsonNullableString(json['departmentId']),
        departmentSlug: jsonNullableString(json['departmentSlug']),
        packageId: jsonNullableString(json['packageId']),
        packageSlug: jsonNullableString(json['packageSlug']),
        serviceMode: jsonNullableString(json['serviceMode']),
        doctorId: jsonNullableString(json['doctorId']),
        date: jsonNullableString(json['date']),
        timeSlotId: jsonNullableString(json['timeSlotId']),
        symptoms: _strings(json['symptoms']),
        bodyParts: _strings(json['bodyParts']),
        symptomDuration: jsonNullableString(json['symptomDuration']),
        symptomSeverity: jsonNullableString(json['symptomSeverity']),
        associatedSymptoms: _strings(json['associatedSymptoms']),
        triageLastQuestion: jsonNullableString(json['triageLastQuestion']),
        reason: jsonNullableString(json['reason']),
        focus: ChatFocus.tryParse(json['focus']),
      );

  final String? departmentId;
  final String? departmentSlug;
  final String? packageId;
  final String? packageSlug;
  final String? serviceMode;
  final String? doctorId;
  final String? date;
  final String? timeSlotId;
  final List<String> symptoms;
  final List<String> bodyParts;
  final String? symptomDuration;
  final String? symptomSeverity;
  final List<String> associatedSymptoms;
  final String? triageLastQuestion;
  final String? reason;
  final ChatFocus? focus;

  Map<String, dynamic> toJson() => {
    if (departmentId != null) 'departmentId': departmentId,
    if (departmentSlug != null) 'departmentSlug': departmentSlug,
    if (packageId != null) 'packageId': packageId,
    if (packageSlug != null) 'packageSlug': packageSlug,
    if (serviceMode != null) 'serviceMode': serviceMode,
    if (doctorId != null) 'doctorId': doctorId,
    if (date != null) 'date': date,
    if (timeSlotId != null) 'timeSlotId': timeSlotId,
    if (symptoms.isNotEmpty) 'symptoms': symptoms,
    if (bodyParts.isNotEmpty) 'bodyParts': bodyParts,
    if (symptomDuration != null) 'symptomDuration': symptomDuration,
    if (symptomSeverity != null) 'symptomSeverity': symptomSeverity,
    if (associatedSymptoms.isNotEmpty) 'associatedSymptoms': associatedSymptoms,
    if (triageLastQuestion != null) 'triageLastQuestion': triageLastQuestion,
    if (reason != null) 'reason': reason,
    if (focus != null) 'focus': focus!.toJson(),
  };
}

class ChatbotAction {
  const ChatbotAction({
    required this.type,
    required this.label,
    this.payload = const {},
  });

  factory ChatbotAction.fromJson(Map<String, dynamic> json) => ChatbotAction(
    type: json['type']?.toString() ?? '',
    label: json['label']?.toString() ?? '',
    payload: jsonMap(json['payload']),
  );

  final String type;
  final String label;
  final Map<String, dynamic> payload;

  /// Nút "hỏi thêm" mang sẵn câu hỏi đầy đủ (có tên bác sĩ, gói...) gửi như người dùng gõ; nhãn ngắn chỉ để hiển thị.
  String? get question {
    if (type != 'ASK_QUESTION') return null;
    final value = payload['question']?.toString().trim();
    return value == null || value.isEmpty ? null : value;
  }

  Map<String, dynamic> toJson() => {
    'type': type,
    'label': label,
    'payload': payload,
  };
}

/// Nguồn tri thức mà câu trả lời dựa vào, để người dùng mở trang gốc kiểm tra.
class ChatbotSourceRef {
  const ChatbotSourceRef({
    required this.id,
    required this.title,
    this.url,
    this.reviewedBy,
    this.updatedAt,
  });

  factory ChatbotSourceRef.fromJson(Map<String, dynamic> json) =>
      ChatbotSourceRef(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        url: jsonNullableString(json['url']),
        reviewedBy: jsonNullableString(json['reviewedBy']),
        updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
      );

  final String id;
  final String title;
  final String? url;

  /// Người duyệt nội dung và ngày cập nhật; chỉ có với nguồn là nội dung được duyệt (chuyên khoa, bác sĩ, bài viết).
  final String? reviewedBy;
  final DateTime? updatedAt;

  /// Dòng kiểm chứng dưới nguồn, ngày tính theo giờ Việt Nam: "Duyệt bởi X · cập nhật 12/11/2026"; không có ngày thì không có dòng này.
  String? get reviewLine {
    final instant = updatedAt;
    if (instant == null) return null;
    final local = instant.toUtc().add(const Duration(hours: 7));
    String two(int value) => value.toString().padLeft(2, '0');
    final date = '${two(local.day)}/${two(local.month)}/${local.year}';
    final reviewer = reviewedBy?.trim();
    return reviewer == null || reviewer.isEmpty
        ? 'Cập nhật $date'
        : 'Duyệt bởi $reviewer · cập nhật $date';
  }
}

enum ChatbotResultType {
  department,
  package,
  doctor,
  slot,
  appointment,
  unknown,
}

/// Trạng thái lịch hẹn hiển thị trong thẻ của Kun.
const chatbotAppointmentStatusLabels = {
  'PENDING_OTP': 'Chờ xác thực OTP',
  'PENDING_CONFIRM': 'Chờ xác nhận',
  'CONFIRMED': 'Đã xác nhận',
  'CHECKED_IN': 'Đã tiếp đón',
  'IN_PROGRESS': 'Đang khám',
  'COMPLETED': 'Đã khám xong',
  'RESCHEDULED': 'Đã dời lịch',
  'CANCELLED_BY_PATIENT': 'Bạn đã hủy',
  'CANCELLED_BY_DOCTOR': 'Bác sĩ đã hủy',
  'CANCELLED_BY_ADMIN': 'Cơ sở đã hủy',
  'NO_SHOW': 'Không đến khám',
};

class ChatbotResultItem {
  const ChatbotResultItem({
    required this.type,
    required this.id,
    this.name,
    this.slug,
    this.description,
    this.departmentId,
    this.departmentName,
    this.summary,
    this.finalPrice = 0,
    this.fullName,
    this.title,
    this.specialization,
    this.consultationFee = 0,
    this.doctorId,
    this.doctorName,
    this.date,
    this.startTime,
    this.endTime,
    this.bookingCode,
    this.status,
    this.canCancel = false,
  });

  factory ChatbotResultItem.fromJson(Map<String, dynamic> json) =>
      ChatbotResultItem(
        type: switch (json['type']?.toString()) {
          'department' => ChatbotResultType.department,
          'package' => ChatbotResultType.package,
          'doctor' => ChatbotResultType.doctor,
          'slot' => ChatbotResultType.slot,
          'appointment' => ChatbotResultType.appointment,
          _ => ChatbotResultType.unknown,
        },
        id: json['id']?.toString() ?? '',
        name: jsonNullableString(json['name']),
        slug: jsonNullableString(json['slug']),
        description: jsonNullableString(json['description']),
        departmentId: jsonNullableString(json['departmentId']),
        departmentName: jsonNullableString(json['departmentName']),
        summary: jsonNullableString(json['summary']),
        finalPrice: jsonNumber(json['finalPrice']),
        fullName: jsonNullableString(json['fullName']),
        title: jsonNullableString(json['title']),
        specialization: jsonNullableString(json['specialization']),
        consultationFee: jsonNumber(json['consultationFee']),
        doctorId: jsonNullableString(json['doctorId']),
        doctorName: jsonNullableString(json['doctorName']),
        date: jsonNullableString(json['date']),
        startTime: jsonNullableString(json['startTime']),
        endTime: jsonNullableString(json['endTime']),
        bookingCode: jsonNullableString(json['bookingCode']),
        status: jsonNullableString(json['status']),
        canCancel: json['canCancel'] == true,
      );

  final ChatbotResultType type;
  final String id;
  final String? name;
  final String? slug;
  final String? description;
  final String? departmentId;
  final String? departmentName;
  final String? summary;
  final double finalPrice;
  final String? fullName;
  final String? title;
  final String? specialization;
  final double consultationFee;
  final String? doctorId;
  final String? doctorName;
  final String? date;
  final String? startTime;
  final String? endTime;

  /// Chỉ có ở thẻ lịch hẹn của chính người dùng.
  final String? bookingCode;
  final String? status;
  final bool canCancel;

  String get displayName => switch (type) {
    ChatbotResultType.doctor => formatProfessionalName(
      title: title,
      fullName: fullName ?? '',
    ),
    ChatbotResultType.slot =>
      doctorName == null
          ? 'Bác sĩ phù hợp'
          : normalizeProfessionalName(doctorName!),
    ChatbotResultType.appointment => bookingCode ?? 'Lịch hẹn',
    _ => name ?? '',
  };

  ChatbotAction? get action => switch (type) {
    ChatbotResultType.department when id.isNotEmpty => ChatbotAction(
      type: 'VIEW_DEPARTMENT',
      label: name ?? 'Xem chuyên khoa',
      payload: {'departmentId': id, if (slug != null) 'departmentSlug': slug},
    ),
    ChatbotResultType.package when id.isNotEmpty => ChatbotAction(
      type: 'VIEW_PACKAGE',
      label: name ?? 'Xem gói khám',
      payload: {
        'packageId': id,
        if (slug != null) 'packageSlug': slug,
        if (departmentId != null) 'departmentId': departmentId,
      },
    ),
    ChatbotResultType.doctor when id.isNotEmpty => ChatbotAction(
      type: 'VIEW_DOCTOR',
      label: displayName,
      payload: {
        'doctorId': id,
        if (departmentId != null) 'departmentId': departmentId,
      },
    ),
    ChatbotResultType.slot
        when id.isNotEmpty && doctorId != null && date != null =>
      ChatbotAction(
        type: 'VIEW_AVAILABLE_SLOTS',
        label: '${_formatDate(date!)} ${startTime ?? ''}-${endTime ?? ''}',
        payload: {'doctorId': doctorId, 'date': date, 'timeSlotId': id},
      ),
    _ => null,
  };
}

class ChatbotResultGroup {
  const ChatbotResultGroup({
    required this.type,
    required this.title,
    required this.items,
    required this.total,
    required this.limit,
    this.description,
  });

  factory ChatbotResultGroup.fromJson(Map<String, dynamic> json) =>
      ChatbotResultGroup(
        type: json['type']?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        description: jsonNullableString(json['description']),
        items: _maps(
          json['items'],
        ).map(ChatbotResultItem.fromJson).toList(growable: false),
        total: jsonInt(json['total']),
        limit: jsonInt(json['limit']),
      );

  final String type;
  final String title;
  final String? description;
  final List<ChatbotResultItem> items;
  final int total;
  final int limit;
}

class ChatbotResponse {
  const ChatbotResponse({
    required this.sessionId,
    this.traceId,
    required this.source,
    required this.reply,
    required this.intent,
    required this.state,
    required this.nextStep,
    required this.confidence,
    required this.draft,
    required this.results,
    required this.suggestedActions,
    this.sources = const [],
  });

  factory ChatbotResponse.fromJson(Map<String, dynamic> json) =>
      ChatbotResponse(
        sessionId: json['sessionId']?.toString() ?? '',
        traceId: jsonNullableString(json['traceId']),
        source: switch (json['source']?.toString()) {
          'SYSTEM' => ChatbotSource.system,
          'FAQ' => ChatbotSource.faq,
          'AI' => ChatbotSource.ai,
          'FALLBACK' => ChatbotSource.fallback,
          'EMERGENCY' => ChatbotSource.emergency,
          _ => ChatbotSource.unknown,
        },
        reply: json['reply']?.toString() ?? '',
        intent: json['intent']?.toString() ?? '',
        state: json['state']?.toString() ?? '',
        nextStep: json['nextStep']?.toString() ?? '',
        confidence: jsonNumber(json['confidence']),
        draft: ChatBookingDraft.fromJson(jsonMap(json['draft'])),
        results: _maps(
          json['results'],
        ).map(ChatbotResultGroup.fromJson).toList(growable: false),
        suggestedActions: _maps(
          json['suggestedActions'],
        ).map(ChatbotAction.fromJson).toList(growable: false),
        sources: _maps(json['sources'])
            .map(ChatbotSourceRef.fromJson)
            .where((source) => source.title.isNotEmpty)
            .toList(growable: false),
      );

  final String sessionId;

  /// Mã vết của lượt trả lời, để nhân viên tra cứu khi người dùng báo lỗi.
  final String? traceId;
  final ChatbotSource source;
  final String reply;
  final String intent;
  final String state;
  final String nextStep;
  final double confidence;
  final ChatBookingDraft draft;
  final List<ChatbotResultGroup> results;
  final List<ChatbotAction> suggestedActions;
  final List<ChatbotSourceRef> sources;
}

List<Map<String, dynamic>> _maps(dynamic value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false)
    : const [];

List<String> _strings(dynamic value) => value is List
    ? value.map((item) => item.toString()).toList(growable: false)
    : const [];

String _formatDate(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  return match == null
      ? value
      : '${match.group(3)}/${match.group(2)}/${match.group(1)}';
}
