import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_health_screen.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_personal_screen.dart';

PatientProfile _profile({String? allergies, String? consentVersion}) =>
    PatientProfile(
      id: 'patient-1',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      email: 'an@example.test',
      isEmailVerified: true,
      hasBhyt: false,
      allergies: allergies,
      healthConsentVersion: consentVersion,
    );

class _RecordingController extends PatientProfileController {
  _RecordingController(this._initial, this.saved);

  final PatientProfile _initial;
  final List<Map<String, Object?>> saved;

  @override
  PatientProfileState build() => PatientProfileState(profile: _initial);

  @override
  Future<bool> saveFields(Map<String, Object?> fields) async {
    saved.add(fields);
    return true;
  }
}

Future<void> _open(
  WidgetTester tester,
  Widget screen,
  PatientProfile profile,
  List<Map<String, Object?>> saved,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        patientProfileControllerProvider.overrideWith(
          () => _RecordingController(profile, saved),
        ),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tapRow(WidgetTester tester, String key) async {
  final row = find.byKey(ValueKey(key));
  await tester.ensureVisible(row);
  await tester.tap(row);
  await tester.pumpAndSettle();
}

void main() {
  test('only the current consent version counts as consented', () {
    PatientProfile parse(Object? version) => PatientProfile.fromJson({
      'id': 'p',
      'fullName': 'An',
      'patientProfile': {'healthConsentVersion': version},
    });

    expect(parse(currentHealthConsentVersion).hasHealthConsent, isTrue);
    expect(parse('2025-01').hasHealthConsent, isFalse);
    expect(parse(null).hasHealthConsent, isFalse);
  });

  group('personal screen', () {
    testWidgets('edits only the tapped row and saves just that field', (
      tester,
    ) async {
      final saved = <Map<String, Object?>>[];
      await _open(tester, const ProfilePersonalScreen(), _profile(), saved);

      await _tapRow(tester, 'row-fullName');
      await tester.enterText(
        find.byKey(const ValueKey('edit-sheet-field')),
        '  Nguyễn Văn Bình ',
      );
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();

      expect(saved, [
        {'fullName': 'Nguyễn Văn Bình'},
      ]);
    });

    testWidgets('rejects an invalid phone number in the sheet', (tester) async {
      final saved = <Map<String, Object?>>[];
      await _open(tester, const ProfilePersonalScreen(), _profile(), saved);

      await _tapRow(tester, 'row-phone');
      await tester.enterText(
        find.byKey(const ValueKey('edit-sheet-field')),
        '12345',
      );
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();

      expect(saved, isEmpty);
      expect(find.text('Số điện thoại không đúng định dạng.'), findsOneWidget);
    });

    testWidgets('clearing an optional field sends null', (tester) async {
      final saved = <Map<String, Object?>>[];
      await _open(tester, const ProfilePersonalScreen(), _profile(), saved);

      await _tapRow(tester, 'row-phone');
      await tester.enterText(
        find.byKey(const ValueKey('edit-sheet-field')),
        '',
      );
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();

      expect(saved, [
        {'phone': null},
      ]);
    });
  });

  group('health consent', () {
    testWidgets('blocks saving new health text until the user agrees', (
      tester,
    ) async {
      final saved = <Map<String, Object?>>[];
      await _open(tester, const ProfileHealthScreen(), _profile(), saved);

      await _tapRow(tester, 'row-allergies');
      await tester.enterText(
        find.byKey(const ValueKey('edit-sheet-field')),
        'Penicillin',
      );
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();
      expect(saved, isEmpty);
      expect(find.text('Cần đồng ý để lưu nội dung này.'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('health-consent-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();

      expect(saved, [
        {'allergies': 'Penicillin', 'healthConsent': true},
      ]);
    });

    testWidgets('does not ask again after the user already consented', (
      tester,
    ) async {
      final saved = <Map<String, Object?>>[];
      await _open(
        tester,
        const ProfileHealthScreen(),
        _profile(
          allergies: 'Penicillin',
          consentVersion: currentHealthConsentVersion,
        ),
        saved,
      );

      await _tapRow(tester, 'row-allergies');
      expect(
        find.byKey(const ValueKey('health-consent-checkbox')),
        findsNothing,
      );
      await tester.enterText(
        find.byKey(const ValueKey('edit-sheet-field')),
        'Penicillin, Aspirin',
      );
      await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
      await tester.pumpAndSettle();

      expect(saved, [
        {'allergies': 'Penicillin, Aspirin'},
      ]);
    });
  });
}
