import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

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
    required this.isPhoneVerified,
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
    final details = _map(json['patientProfile']);
    return PatientProfile(
      id: _string(json['id']),
      fullName: _string(json['fullName'], fallback: 'Người khám'),
      phone: _nullableString(json['phone']),
      email: _nullableString(json['email']),
      avatar: _nullableString(json['avatar']),
      isPhoneVerified: json['isPhoneVerified'] == true,
      dateOfBirth: _dateOnly(details['dateOfBirth']),
      gender: details['gender'] == null
          ? null
          : PatientGender.fromApi(details['gender']),
      cccd: _nullableString(details['cccd']),
      address: _nullableString(details['address']),
      hasBhyt: details['hasBHYT'] == true,
      healthInsuranceCode: _nullableString(details['healthInsuranceCode']),
      registeredHospital: _nullableString(details['registeredHospital']),
      bloodType: _nullableString(details['bloodType']),
      height: _nullableDouble(details['height']),
      weight: _nullableDouble(details['weight']),
      allergies: _nullableString(details['allergies']),
      medicalHistory: _nullableString(details['medicalHistory']),
      familyHistory: _nullableString(details['familyHistory']),
      bloodPressure: _nullableString(details['bloodPressure']),
      healthConsentVersion: _nullableString(details['healthConsentVersion']),
    );
  }

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? avatar;
  final bool isPhoneVerified;
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
    isPhoneVerified: isPhoneVerified,
  );

  int get completionPercent {
    final checks = <bool>[
      fullName.trim().isNotEmpty,
      phone != null,
      email != null,
      dateOfBirth != null,
      gender != null,
      cccd != null,
      address != null,
      !hasBhyt || healthInsuranceCode != null,
      bloodType != null,
      height != null && weight != null,
      allergies != null,
      medicalHistory != null,
    ];
    final completed = checks.where((value) => value).length;
    return ((completed / checks.length) * 100).round();
  }
}

class PatientProfileDraft {
  const PatientProfileDraft({
    required this.fullName,
    required this.hasBhyt,
    this.email,
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
    this.healthConsent = false,
  });

  final String fullName;
  final String? email;
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

  /// Người dùng vừa tick đồng ý lưu thông tin sức khỏe ở lần lưu này.
  final bool healthConsent;

  Map<String, dynamic> toRequestJson() => {
    'fullName': fullName.trim(),
    'email': _trimOrNull(email),
    'dateOfBirth': _trimOrNull(dateOfBirth),
    'gender': gender?.apiValue,
    'cccd': _trimOrNull(cccd),
    'address': _trimOrNull(address),
    'hasBHYT': hasBhyt,
    'healthInsuranceCode': hasBhyt ? _trimOrNull(healthInsuranceCode) : null,
    'registeredHospital': hasBhyt ? _trimOrNull(registeredHospital) : null,
    'bloodType': _trimOrNull(bloodType),
    'height': height,
    'weight': weight,
    'allergies': _trimOrNull(allergies),
    'medicalHistory': _trimOrNull(medicalHistory),
    'familyHistory': _trimOrNull(familyHistory),
    'bloodPressure': _trimOrNull(bloodPressure),
    if (healthConsent) 'healthConsent': true,
  };
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String _string(dynamic value, {String fallback = ''}) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? fallback : result;
}

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

String? _dateOnly(dynamic value) {
  final raw = _nullableString(value);
  if (raw == null) return null;
  return RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(raw)?.group(0);
}

double? _nullableDouble(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse(value?.toString() ?? '');

String? _trimOrNull(String? value) {
  final result = value?.trim();
  return result == null || result.isEmpty ? null : result;
}
