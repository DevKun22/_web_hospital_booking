import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum BookingServiceMode { doctor, package }

extension BookingServiceModeValue on BookingServiceMode {
  String get apiValue =>
      this == BookingServiceMode.package ? 'PACKAGE' : 'DOCTOR_ONLY';
}

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
        slug: jsonNullableString(json['slug']),
        description: jsonNullableString(json['description']),
        image: jsonNullableString(json['image']),
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
    final user = jsonMap(json['user']);
    final department = jsonMap(json['department']);
    return BookingDoctor(
      id: json['id']?.toString() ?? '',
      fullName: user['fullName']?.toString() ?? '',
      departmentId: department['id']?.toString() ?? '',
      departmentName: department['name']?.toString() ?? '',
      consultationFee: jsonNumber(json['consultationFee']),
      title: jsonNullableString(json['title']),
      bio: jsonNullableString(json['bio']),
      specialization: jsonNullableString(json['specialization']),
      avatar: jsonNullableString(user['avatar']),
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
    date: jsonDateOnly(json['date']?.toString() ?? ''),
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
    this.serviceMode = BookingServiceMode.doctor,
    this.packageId,
    this.departmentId,
    this.doctorId,
    this.date,
    this.slotId,
  });

  factory BookingSelection.fromJson(Map<String, dynamic> json) =>
      BookingSelection(
        serviceMode:
            json['serviceMode']?.toString().toUpperCase() == 'PACKAGE' ||
                jsonNullableString(json['packageId']) != null
            ? BookingServiceMode.package
            : BookingServiceMode.doctor,
        packageId: jsonNullableString(json['packageId']),
        departmentId: jsonNullableString(json['departmentId']),
        doctorId: jsonNullableString(json['doctorId']),
        date: jsonNullableString(json['date']),
        slotId: jsonNullableString(json['slotId']),
      );

  final BookingServiceMode serviceMode;
  final String? packageId;
  final String? departmentId;
  final String? doctorId;
  final String? date;
  final String? slotId;

  bool get isComplete =>
      (serviceMode != BookingServiceMode.package || packageId != null) &&
      departmentId != null &&
      doctorId != null &&
      date != null &&
      slotId != null;

  Map<String, dynamic> toJson() => {
    'serviceMode': serviceMode.apiValue,
    'packageId': packageId,
    'departmentId': departmentId,
    'doctorId': doctorId,
    'date': date,
    'slotId': slotId,
  };
}

int? _nullableInt(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');
