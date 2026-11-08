import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_edit_screen.dart';

PatientProfile _profile({String? allergies, String? consentVersion}) =>
    PatientProfile(
      id: 'patient-1',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      email: 'an@example.test',
      isPhoneVerified: true,
      hasBhyt: false,
      allergies: allergies,
      healthConsentVersion: consentVersion,
    );

class _RecordingController extends PatientProfileController {
  _RecordingController(this._initial, this.saved);

  final PatientProfile _initial;
  final List<PatientProfileDraft> saved;

  @override
  PatientProfileState build() => PatientProfileState(profile: _initial);

  @override
  Future<bool> save(PatientProfileDraft draft) async {
    saved.add(draft);
    return true;
  }
}

Future<void> _openEditor(
  WidgetTester tester,
  PatientProfile profile,
  List<PatientProfileDraft> saved,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        patientProfileControllerProvider.overrideWith(
          () => _RecordingController(profile, saved),
        ),
      ],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () => Navigator.push<void>(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const ProfileEditScreen(),
                ),
              ),
              child: const Text('Mở chỉnh sửa'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Mở chỉnh sửa'));
  await tester.pumpAndSettle();
}

Future<void> _enterField(WidgetTester tester, String label, String text) async {
  final field = find.widgetWithText(TextFormField, label);
  await tester.scrollUntilVisible(
    field,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.enterText(field, text);
  await tester.pumpAndSettle();
}

Future<void> _tapSave(WidgetTester tester) async {
  final save = find.text('Lưu thay đổi');
  await tester.scrollUntilVisible(
    save,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  await tester.tap(save);
  await tester.pumpAndSettle();
}

void main() {
  group('health consent data', () {
    test('request only carries healthConsent when the user agreed', () {
      const without = PatientProfileDraft(fullName: 'An', hasBhyt: false);
      const withConsent = PatientProfileDraft(
        fullName: 'An',
        hasBhyt: false,
        healthConsent: true,
      );

      expect(without.toRequestJson().containsKey('healthConsent'), isFalse);
      expect(withConsent.toRequestJson()['healthConsent'], isTrue);
    });

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
  });

  group('profile edit consent', () {
    testWidgets('blocks saving new health text until the user agrees', (
      tester,
    ) async {
      final saved = <PatientProfileDraft>[];
      await _openEditor(tester, _profile(), saved);

      expect(
        find.byKey(const ValueKey('health-consent-checkbox')),
        findsNothing,
      );

      await _enterField(tester, 'Dị ứng', 'Penicillin');
      final checkbox = find.byKey(const ValueKey('health-consent-checkbox'));
      await tester.scrollUntilVisible(
        checkbox,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(checkbox, findsOneWidget);

      await _tapSave(tester);
      expect(saved, isEmpty);
      expect(
        find.text(
          'Vui lòng đồng ý lưu thông tin sức khỏe để cập nhật dị ứng và tiền sử.',
        ),
        findsOneWidget,
      );

      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        checkbox,
        -300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(checkbox);
      await tester.pumpAndSettle();
      await _tapSave(tester);
      expect(saved, hasLength(1));
      expect(saved.single.healthConsent, isTrue);
      expect(saved.single.allergies, 'Penicillin');
    });

    testWidgets('does not ask again after the user already consented', (
      tester,
    ) async {
      final saved = <PatientProfileDraft>[];
      await _openEditor(
        tester,
        _profile(
          allergies: 'Penicillin',
          consentVersion: currentHealthConsentVersion,
        ),
        saved,
      );

      expect(
        find.byKey(const ValueKey('health-consent-checkbox')),
        findsNothing,
      );
      await _enterField(tester, 'Dị ứng', 'Penicillin, Aspirin');
      await _tapSave(tester);

      expect(saved, hasLength(1));
      expect(saved.single.healthConsent, isFalse);
    });

    testWidgets('legacy health text can be resaved without consent', (
      tester,
    ) async {
      final saved = <PatientProfileDraft>[];
      await _openEditor(tester, _profile(allergies: 'Penicillin'), saved);

      await _enterField(tester, 'Họ và tên *', 'Nguyễn Văn Bình');
      await _tapSave(tester);

      expect(saved, hasLength(1));
      expect(saved.single.fullName, 'Nguyễn Văn Bình');
      expect(saved.single.healthConsent, isFalse);
    });
  });
}
