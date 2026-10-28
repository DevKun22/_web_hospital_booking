import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

void main() {
  test('dependent profile parses API values and keeps date-only semantics', () {
    final profile = DependentProfile.fromJson({
      'id': 'dependent-1',
      'fullName': 'Nguyễn Minh Anh',
      'relationship': 'CHILD',
      'dateOfBirth': '2015-05-20T00:00:00.000Z',
      'gender': 'FEMALE',
      'hasBHYT': true,
      'healthInsuranceCode': 'GD401010000001',
    });

    expect(profile.relationship, DependentRelationship.child);
    expect(profile.dateOfBirth, '2015-05-20');
    expect(profile.hasBhyt, isTrue);
  });

  test('draft clears insurance details when BHYT is disabled', () {
    const draft = DependentProfileDraft(
      fullName: 'Nguyễn Minh Anh',
      relationship: DependentRelationship.child,
      hasBhyt: false,
      consentConfirmed: true,
      healthInsuranceCode: 'must-not-be-sent',
      registeredHospital: 'must-not-be-sent',
    );

    final json = draft.toRequestJson(includeConsent: true);
    expect(json['relationship'], 'CHILD');
    expect(json['healthInsuranceCode'], isNull);
    expect(json['registeredHospital'], isNull);
    expect(json['consentConfirmed'], isTrue);
  });
}
