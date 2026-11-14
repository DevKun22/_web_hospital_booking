import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum DependentRelationship {
  child('CHILD', 'Con'),
  spouse('SPOUSE', 'Vợ / chồng'),
  parent('PARENT', 'Cha / mẹ'),
  sibling('SIBLING', 'Anh / chị / em'),
  other('OTHER', 'Khác');

  const DependentRelationship(this.apiValue, this.label);

  factory DependentRelationship.fromApi(dynamic value) =>
      DependentRelationship.values.firstWhere(
        (item) => item.apiValue == value?.toString().toUpperCase(),
        orElse: () => DependentRelationship.other,
      );

  final String apiValue;
  final String label;
}

class DependentProfile {
  const DependentProfile({
    required this.id,
    required this.fullName,
    required this.relationship,
    required this.hasBhyt,
    this.phone,
    this.email,
    this.dateOfBirth,
    this.gender,
    this.cccd,
    this.address,
    this.healthInsuranceCode,
    this.registeredHospital,
    this.allergies,
    this.medicalHistory,
    this.familyHistory,
    this.consentConfirmedAt,
  });

  factory DependentProfile.fromJson(Map<String, dynamic> json) =>
      DependentProfile(
        id: json['id']?.toString() ?? '',
        fullName: json['fullName']?.toString().trim() ?? '',
        relationship: DependentRelationship.fromApi(json['relationship']),
        phone: jsonNullableString(json['phone']),
        email: jsonNullableString(json['email']),
        dateOfBirth: jsonNullableDateOnly(json['dateOfBirth']),
        gender: jsonNullableString(json['gender']),
        cccd: jsonNullableString(json['cccd']),
        address: jsonNullableString(json['address']),
        hasBhyt: json['hasBHYT'] == true,
        healthInsuranceCode: jsonNullableString(json['healthInsuranceCode']),
        registeredHospital: jsonNullableString(json['registeredHospital']),
        allergies: jsonNullableString(json['allergies']),
        medicalHistory: jsonNullableString(json['medicalHistory']),
        familyHistory: jsonNullableString(json['familyHistory']),
        consentConfirmedAt: DateTime.tryParse(
          json['consentConfirmedAt']?.toString() ?? '',
        ),
      );

  final String id;
  final String fullName;
  final DependentRelationship relationship;
  final String? phone;
  final String? email;
  final String? dateOfBirth;
  final String? gender;
  final String? cccd;
  final String? address;
  final bool hasBhyt;
  final String? healthInsuranceCode;
  final String? registeredHospital;
  final String? allergies;
  final String? medicalHistory;
  final String? familyHistory;
  final DateTime? consentConfirmedAt;
}

class DependentProfileDraft {
  const DependentProfileDraft({
    required this.fullName,
    required this.relationship,
    required this.hasBhyt,
    this.phone,
    this.email,
    this.dateOfBirth,
    this.gender,
    this.cccd,
    this.address,
    this.healthInsuranceCode,
    this.registeredHospital,
    this.allergies,
    this.medicalHistory,
    this.familyHistory,
    this.consentConfirmed = false,
  });

  factory DependentProfileDraft.fromProfile(DependentProfile profile) =>
      DependentProfileDraft(
        fullName: profile.fullName,
        relationship: profile.relationship,
        hasBhyt: profile.hasBhyt,
        phone: profile.phone,
        email: profile.email,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        cccd: profile.cccd,
        address: profile.address,
        healthInsuranceCode: profile.healthInsuranceCode,
        registeredHospital: profile.registeredHospital,
        allergies: profile.allergies,
        medicalHistory: profile.medicalHistory,
        familyHistory: profile.familyHistory,
        consentConfirmed: true,
      );

  final String fullName;
  final DependentRelationship relationship;
  final String? phone;
  final String? email;
  final String? dateOfBirth;
  final String? gender;
  final String? cccd;
  final String? address;
  final bool hasBhyt;
  final String? healthInsuranceCode;
  final String? registeredHospital;
  final String? allergies;
  final String? medicalHistory;
  final String? familyHistory;
  final bool consentConfirmed;

  Map<String, dynamic> toRequestJson({bool includeConsent = false}) => {
    'fullName': fullName.trim(),
    'relationship': relationship.apiValue,
    'phone': jsonNullableString(phone),
    'email': jsonNullableString(email),
    'dateOfBirth': jsonNullableString(dateOfBirth),
    'gender': jsonNullableString(gender),
    'cccd': jsonNullableString(cccd),
    'address': jsonNullableString(address),
    'hasBHYT': hasBhyt,
    'healthInsuranceCode': hasBhyt
        ? jsonNullableString(healthInsuranceCode)
        : null,
    'registeredHospital': hasBhyt
        ? jsonNullableString(registeredHospital)
        : null,
    'allergies': jsonNullableString(allergies),
    'medicalHistory': jsonNullableString(medicalHistory),
    'familyHistory': jsonNullableString(familyHistory),
    if (includeConsent) 'consentConfirmed': consentConfirmed,
  };
}
