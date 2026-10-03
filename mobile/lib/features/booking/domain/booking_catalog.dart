import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

class BookingDepartment {
  const BookingDepartment({
    required this.id,
    required this.name,
    this.slug,
    this.description,
    this.image,
  });

  factory BookingDepartment.fromJson(Map<String, dynamic> json) =>
      BookingDepartment(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        slug: _nullableString(json['slug']),
        description: _nullableString(json['description']),
        image: _nullableString(json['image']),
      );

  final String id;
  final String name;
  final String? slug;
  final String? description;
  final String? image;
}

class BookingDoctor {
  const BookingDoctor({
    required this.id,
    required this.fullName,
    required this.departmentId,
    required this.departmentName,
    required this.consultationFee,
    this.title,
    this.bio,
    this.specialization,
    this.avatar,
    this.experience,
  });

  factory BookingDoctor.fromJson(Map<String, dynamic> json) {
    final user = _map(json['user']);
    final department = _map(json['department']);
    return BookingDoctor(
      id: json['id']?.toString() ?? '',
      fullName: user['fullName']?.toString() ?? '',
      departmentId: department['id']?.toString() ?? '',
      departmentName: department['name']?.toString() ?? '',
      consultationFee: _number(json['consultationFee']),
      title: _nullableString(json['title']),
      bio: _nullableString(json['bio']),
      specialization: _nullableString(json['specialization']),
      avatar: _nullableString(user['avatar']),
      experience: _nullableInt(json['experience']),
    );
  }

  final String id;
  final String fullName;
  final String departmentId;
  final String departmentName;
  final double consultationFee;
  final String? title;
  final String? bio;
  final String? specialization;
  final String? avatar;
  final int? experience;

  String get displayName =>
      formatProfessionalName(title: title, fullName: fullName);
}

class BookingSlot {
  const BookingSlot({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
  });

  factory BookingSlot.fromJson(Map<String, dynamic> json) => BookingSlot(
    id: json['id']?.toString() ?? '',
    date: _dateOnly(json['date']?.toString() ?? ''),
    startTime: json['startTime']?.toString() ?? '',
    endTime: json['endTime']?.toString() ?? '',
  );

  final String id;
  final String date;
  final String startTime;
  final String endTime;
}

class BookingSelection {
  const BookingSelection({
    this.departmentId,
    this.doctorId,
    this.date,
    this.slotId,
  });

  factory BookingSelection.fromJson(Map<String, dynamic> json) =>
      BookingSelection(
        departmentId: _nullableString(json['departmentId']),
        doctorId: _nullableString(json['doctorId']),
        date: _nullableString(json['date']),
        slotId: _nullableString(json['slotId']),
      );

  final String? departmentId;
  final String? doctorId;
  final String? date;
  final String? slotId;

  bool get isComplete =>
      departmentId != null &&
      doctorId != null &&
      date != null &&
      slotId != null;

  Map<String, dynamic> toJson() => {
    'departmentId': departmentId,
    'doctorId': doctorId,
    'date': date,
    'slotId': slotId,
  };
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

double _number(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

int? _nullableInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');

String _dateOnly(String value) =>
    RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(value)?.group(0) ?? value;
