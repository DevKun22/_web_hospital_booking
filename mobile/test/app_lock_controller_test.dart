import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/security/application/app_lock_controller.dart';

const _user = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Minh Anh',
  phone: '0391234567',
  isPhoneVerified: true,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _user);
}

class _SuccessfulLocalAuthentication implements LocalAuthenticationGateway {
  @override
  Future<bool> authenticate() async => true;

  @override
  Future<bool> isSupported() async => true;
}

Future<ProviderContainer> _container() async {
  final container = ProviderContainer(
    overrides: [
      authControllerProvider.overrideWith(_AuthenticatedController.new),
      appPreferencesProvider.overrideWithValue(
        MemoryAppPreferences(appLockEnabled: true),
      ),
      localAuthenticationGatewayProvider.overrideWithValue(
        _SuccessfulLocalAuthentication(),
      ),
    ],
  );
  container.read(appLockControllerProvider);
  await Future<void>.delayed(Duration.zero);
  return container;
}

void main() {
  test('brief background transition stays unlocked', () async {
    final container = await _container();
    addTearDown(container.dispose);
    final controller = container.read(appLockControllerProvider.notifier);

    expect(await controller.unlock(), isTrue);
    final backgroundedAt = DateTime(2030, 1, 1, 10);
    controller.noteBackgrounded(now: backgroundedAt);
    controller.handleAppResumed(
      now: backgroundedAt.add(
        Duration(
          milliseconds: appLockBackgroundGracePeriod.inMilliseconds ~/ 2,
        ),
      ),
    );

    expect(container.read(appLockControllerProvider).locked, isFalse);
  });

  test('background transition beyond grace period locks the app', () async {
    final container = await _container();
    addTearDown(container.dispose);
    final controller = container.read(appLockControllerProvider.notifier);

    expect(await controller.unlock(), isTrue);
    final backgroundedAt = DateTime(2030, 1, 1, 10);
    controller.noteBackgrounded(now: backgroundedAt);
    controller.handleAppResumed(
      now: backgroundedAt.add(
        appLockBackgroundGracePeriod + const Duration(seconds: 1),
      ),
    );

    expect(container.read(appLockControllerProvider).locked, isTrue);
  });
}
