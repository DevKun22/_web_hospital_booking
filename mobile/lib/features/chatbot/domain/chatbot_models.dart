enum ChatbotSource { system, faq, ai, fallback, emergency, unknown }

extension ChatbotSourceLabel on ChatbotSource {
  String get label => switch (this) {
    ChatbotSource.system => 'Hệ thống gợi ý',
    ChatbotSource.faq => 'Kho FAQ trả lời',
    ChatbotSource.ai => 'AI phân tích · dữ liệu bệnh viện',
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
    final value = _map(json['value']);
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
  });

  factory ChatBookingDraft.fromJson(Map<String, dynamic> json) =>
      ChatBookingDraft(
        departmentId: _nullableString(json['departmentId']),
        departmentSlug: _nullableString(json['departmentSlug']),
        packageId: _nullableString(json['packageId']),
        packageSlug: _nullableString(json['packageSlug']),
        serviceMode: _nullableString(json['serviceMode']),
        doctorId: _nullableString(json['doctorId']),
        date: _nullableString(json['date']),
        timeSlotId: _nullableString(json['timeSlotId']),
        symptoms: _strings(json['symptoms']),
        bodyParts: _strings(json['bodyParts']),
        symptomDuration: _nullableString(json['symptomDuration']),
        symptomSeverity: _nullableString(json['symptomSeverity']),
        associatedSymptoms: _strings(json['associatedSymptoms']),
        triageLastQuestion: _nullableString(json['triageLastQuestion']),
        reason: _nullableString(json['reason']),
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
    payload: _map(json['payload']),
  );

  final String type;
  final String label;
  final Map<String, dynamic> payload;

  Map<String, dynamic> toJson() => {
    'type': type,
    'label': label,
    'payload': payload,
  };
}

enum ChatbotResultType { department, package, doctor, slot, unknown }

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
  });

  factory ChatbotResultItem.fromJson(Map<String, dynamic> json) =>
      ChatbotResultItem(
        type: switch (json['type']?.toString()) {
          'department' => ChatbotResultType.department,
          'package' => ChatbotResultType.package,
          'doctor' => ChatbotResultType.doctor,
          'slot' => ChatbotResultType.slot,
          _ => ChatbotResultType.unknown,
        },
        id: json['id']?.toString() ?? '',
        name: _nullableString(json['name']),
        slug: _nullableString(json['slug']),
        description: _nullableString(json['description']),
        departmentId: _nullableString(json['departmentId']),
        departmentName: _nullableString(json['departmentName']),
        summary: _nullableString(json['summary']),
        finalPrice: _number(json['finalPrice']),
        fullName: _nullableString(json['fullName']),
        title: _nullableString(json['title']),
        specialization: _nullableString(json['specialization']),
        consultationFee: _number(json['consultationFee']),
        doctorId: _nullableString(json['doctorId']),
        doctorName: _nullableString(json['doctorName']),
        date: _nullableString(json['date']),
        startTime: _nullableString(json['startTime']),
        endTime: _nullableString(json['endTime']),
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

  String get displayName => switch (type) {
    ChatbotResultType.doctor => '${title ?? ''} ${fullName ?? ''}'.trim(),
    ChatbotResultType.slot => doctorName ?? 'Bác sĩ phù hợp',
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
        description: _nullableString(json['description']),
        items: _maps(
          json['items'],
        ).map(ChatbotResultItem.fromJson).toList(growable: false),
        total: _integer(json['total']),
        limit: _integer(json['limit']),
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
    required this.source,
    required this.reply,
    required this.intent,
    required this.state,
    required this.nextStep,
    required this.confidence,
    required this.draft,
    required this.results,
    required this.suggestedActions,
  });

  factory ChatbotResponse.fromJson(Map<String, dynamic> json) =>
      ChatbotResponse(
        sessionId: json['sessionId']?.toString() ?? '',
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
        confidence: _number(json['confidence']),
        draft: ChatBookingDraft.fromJson(_map(json['draft'])),
        results: _maps(
          json['results'],
        ).map(ChatbotResultGroup.fromJson).toList(growable: false),
        suggestedActions: _maps(
          json['suggestedActions'],
        ).map(ChatbotAction.fromJson).toList(growable: false),
      );

  final String sessionId;
  final ChatbotSource source;
  final String reply;
  final String intent;
  final String state;
  final String nextStep;
  final double confidence;
  final ChatBookingDraft draft;
  final List<ChatbotResultGroup> results;
  final List<ChatbotAction> suggestedActions;
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> _maps(dynamic value) => value is List
    ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false)
    : const [];

List<String> _strings(dynamic value) => value is List
    ? value.map((item) => item.toString()).toList(growable: false)
    : const [];

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double _number(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int _integer(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

String _formatDate(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  return match == null
      ? value
      : '${match.group(3)}/${match.group(2)}/${match.group(1)}';
}
