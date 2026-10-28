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
        phone: _nullable(json['phone']),
        email: _nullable(json['email']),
        dateOfBirth: _dateOnly(json['dateOfBirth']),
        gender: _nullable(json['gender']),
        cccd: _nullable(json['cccd']),
        address: _nullable(json['address']),
        hasBhyt: json['hasBHYT'] == true,
        healthInsuranceCode: _nullable(json['healthInsuranceCode']),
        registeredHospital: _nullable(json['registeredHospital']),
        allergies: _nullable(json['allergies']),
        medicalHistory: _nullable(json['medicalHistory']),
        familyHistory: _nullable(json['familyHistory']),
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
    'phone': _trimOrNull(phone),
    'email': _trimOrNull(email),
    'dateOfBirth': _trimOrNull(dateOfBirth),
    'gender': _trimOrNull(gender),
    'cccd': _trimOrNull(cccd),
    'address': _trimOrNull(address),
    'hasBHYT': hasBhyt,
    'healthInsuranceCode': hasBhyt ? _trimOrNull(healthInsuranceCode) : null,
    'registeredHospital': hasBhyt ? _trimOrNull(registeredHospital) : null,
    'allergies': _trimOrNull(allergies),
    'medicalHistory': _trimOrNull(medicalHistory),
    'familyHistory': _trimOrNull(familyHistory),
    if (includeConsent) 'consentConfirmed': consentConfirmed,
  };
}

String? _nullable(dynamic value) {
  final normalized = value?.toString().trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}

String? _dateOnly(dynamic value) {
  final raw = _nullable(value);
  if (raw == null) return null;
  return RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(raw)?.group(0);
}

String? _trimOrNull(String? value) => _nullable(value);
