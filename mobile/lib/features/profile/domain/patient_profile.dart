import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

/// Phiên bản nội dung đồng ý lưu thông tin sức khỏe; phải khớp `HEALTH_CONSENT_VERSION`
/// ở `backend/src/services/appointment.service.ts`.
const currentHealthConsentVersion = '2026-11';

enum PatientGender {
  male('MALE', 'Nam'),
  female('FEMALE', 'Nữ'),
  other('OTHER', 'Khác');

  const PatientGender(this.apiValue, this.label);

  factory PatientGender.fromApi(dynamic value) =>
      PatientGender.values.firstWhere(
        (gender) => gender.apiValue == value?.toString().toUpperCase(),
        orElse: () => PatientGender.other,
      );

  final String apiValue;
  final String label;
}

class PatientProfile {
  const PatientProfile({
    required this.id,
    required this.fullName,
    required this.isEmailVerified,
    required this.hasBhyt,
    this.phone,
    this.email,
    this.avatar,
    this.dateOfBirth,
    this.gender,
    this.cccd,
    this.address,
    this.healthInsuranceCode,
    this.registeredHospital,
    this.bloodType,
    this.height,
    this.weight,
    this.allergies,
    this.medicalHistory,
    this.familyHistory,
    this.bloodPressure,
    this.healthConsentVersion,
  });

  factory PatientProfile.fromJson(Map<String, dynamic> json) {
    final details = jsonMap(json['patientProfile']);
    return PatientProfile(
      id: jsonText(json['id']),
      fullName: jsonText(json['fullName'], fallback: 'Người khám'),
      phone: jsonNullableString(json['phone']),
      email: jsonNullableString(json['email']),
      avatar: jsonNullableString(json['avatar']),
      isEmailVerified: json['isEmailVerified'] == true,
      dateOfBirth: jsonNullableDateOnly(details['dateOfBirth']),
      gender: details['gender'] == null
          ? null
          : PatientGender.fromApi(details['gender']),
      cccd: jsonNullableString(details['cccd']),
      address: jsonNullableString(details['address']),
      hasBhyt: details['hasBHYT'] == true,
      healthInsuranceCode: jsonNullableString(details['healthInsuranceCode']),
      registeredHospital: jsonNullableString(details['registeredHospital']),
      bloodType: jsonNullableString(details['bloodType']),
      height: _nullableDouble(details['height']),
      weight: _nullableDouble(details['weight']),
      allergies: jsonNullableString(details['allergies']),
      medicalHistory: jsonNullableString(details['medicalHistory']),
      familyHistory: jsonNullableString(details['familyHistory']),
      bloodPressure: jsonNullableString(details['bloodPressure']),
      healthConsentVersion: jsonNullableString(details['healthConsentVersion']),
    );
  }

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? avatar;
  final bool isEmailVerified;
  final String? dateOfBirth;
  final PatientGender? gender;
  final String? cccd;
  final String? address;
  final bool hasBhyt;
  final String? healthInsuranceCode;
  final String? registeredHospital;
  final String? bloodType;
  final double? height;
  final double? weight;
  final String? allergies;
  final String? medicalHistory;
  final String? familyHistory;
  final String? bloodPressure;

  /// Phiên bản nội dung đồng ý lưu thông tin sức khỏe mà người dùng đã xác nhận (null nếu chưa).
  final String? healthConsentVersion;

  /// Đã đồng ý đúng phiên bản nội dung hiện hành; phiên bản cũ hoặc chưa đồng ý thì hỏi lại.
  bool get hasHealthConsent =>
      healthConsentVersion == currentHealthConsentVersion;

  PatientUser toPatientUser() => PatientUser(
    id: id,
    fullName: fullName,
    phone: phone,
    email: email,
    avatar: avatar,
    isEmailVerified: isEmailVerified,
  );

  /// Có thông tin sức khỏe nào chưa: nhóm máu, chiều cao, cân nặng, huyết áp, dị ứng hoặc tiền sử.
  bool get hasHealthInfo =>
      bloodType != null ||
      height != null ||
      weight != null ||
      bloodPressure != null ||
      allergies != null ||
      medicalHistory != null ||
      familyHistory != null;

  /// Sáu mục để cơ sở khám tiếp nhận thuận tiện: ngày sinh, giới tính, số điện thoại, CCCD, địa chỉ, sức khỏe.
  List<bool> get completionChecks => [
    dateOfBirth != null,
    gender != null,
    phone != null,
    cccd != null,
    address != null,
    hasHealthInfo,
  ];

  int get completedCount => completionChecks.where((done) => done).length;
  int get totalCount => completionChecks.length;
}

double? _nullableDouble(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse(value?.toString() ?? '');
