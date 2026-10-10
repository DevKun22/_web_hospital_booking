import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';
import 'package:hospital_booking_mobile/features/profile/data/patient_profile_repository.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Tên từ phiên đăng nhập',
  phone: '0912345678',
  isPhoneVerified: true,
);

PatientProfile _profile({String fullName = 'Nguyễn Văn An'}) => PatientProfile(
  id: 'patient-1',
  fullName: fullName,
  phone: '0912345678',
  email: 'an@example.test',
  isPhoneVerified: true,
  hasBhyt: false,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _FakeProfileRepository extends PatientProfileRepository {
  _FakeProfileRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  int updateCalls = 0;

  @override
  Future<PatientProfile> getProfile() async => _profile();

  @override
  Future<PatientProfile> updateProfile(PatientProfileDraft draft) async {
    updateCalls += 1;
    return _profile(fullName: draft.fullName.trim());
  }
}

class _DelayedProfileRepository extends PatientProfileRepository {
  _DelayedProfileRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  final gate = Completer<PatientProfile>();

  @override
  Future<PatientProfile> getProfile() => gate.future;
}

void main() {
  test(
    'loads profile and synchronizes identity shown across the app',
    () async {
      final repository = _FakeProfileRepository();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          patientProfileRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      container.read(patientProfileControllerProvider);
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(
        container.read(patientProfileControllerProvider).profile?.fullName,
        'Nguyễn Văn An',
      );
      expect(
        container.read(authControllerProvider).user?.fullName,
        'Nguyễn Văn An',
      );

      final saved = await container
          .read(patientProfileControllerProvider.notifier)
          .save(
            const PatientProfileDraft(
              fullName: '  Nguyễn Văn Bình  ',
              hasBhyt: false,
            ),
          );

      expect(saved, isTrue);
      expect(repository.updateCalls, 1);
      expect(
        container.read(patientProfileControllerProvider).profile?.fullName,
        'Nguyễn Văn Bình',
      );
      expect(
        container.read(authControllerProvider).user?.fullName,
        'Nguyễn Văn Bình',
      );
    },
  );

  test('discards protected profile that arrives after logout', () async {
    final repository = _DelayedProfileRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        patientProfileRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(patientProfileControllerProvider);
    await Future<void>.delayed(Duration.zero);
    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    repository.gate.complete(_profile(fullName: 'Dữ liệu riêng tư'));
    await Future<void>.delayed(Duration.zero);

    final state = container.read(patientProfileControllerProvider);
    expect(state.profile, isNull);
    expect(state.isInitialLoading, isFalse);
    expect(container.read(authControllerProvider).isAuthenticated, isFalse);
  });
}
