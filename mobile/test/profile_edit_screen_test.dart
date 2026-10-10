import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_edit_screen.dart';

const _profile = PatientProfile(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  email: 'an@example.test',
  isPhoneVerified: true,
  hasBhyt: false,
);

class _ProfileController extends PatientProfileController {
  @override
  PatientProfileState build() => const PatientProfileState(profile: _profile);
}

void main() {
  testWidgets('warns before discarding unsaved profile changes', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          patientProfileControllerProvider.overrideWith(_ProfileController.new),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
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
      ),
    );

    await tester.tap(find.text('Mở chỉnh sửa'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Họ và tên *'),
      'Nguyễn Văn Bình',
    );
    await tester.pump();
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.text('Bỏ các thay đổi?'), findsOneWidget);
    await tester.tap(find.text('Tiếp tục chỉnh sửa'));
    await tester.pumpAndSettle();
    expect(find.text('Chỉnh sửa hồ sơ'), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bỏ thay đổi'));
    await tester.pumpAndSettle();

    expect(find.text('Mở chỉnh sửa'), findsOneWidget);
  });

  testWidgets('leaves without warning when the profile is unchanged', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          patientProfileControllerProvider.overrideWith(_ProfileController.new),
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
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.text('Bỏ các thay đổi?'), findsNothing);
    expect(find.text('Mở chỉnh sửa'), findsOneWidget);
  });
}
