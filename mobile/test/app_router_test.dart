import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/hospital_booking_app.dart';
import 'package:hospital_booking_mobile/app/router/app_router.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';

class _OtpFlowAuthController extends AuthController {
  final _requestGate = Completer<void>();

  @override
  AuthState build() => const AuthState.unauthenticated();

  @override
  Future<bool> requestOtp(String phone) async {
    state = AuthState(status: AuthStatus.requestingOtp, phone: phone);
    await _requestGate.future;
    state = AuthState(
      status: AuthStatus.awaitingOtp,
      phone: phone,
      challenge: OtpChallenge(
        challengeId: 'challenge-test',
        expiresAt: DateTime(2030),
      ),
    );
    return true;
  }

  void completeRequest() => _requestGate.complete();
}

class _SeenOnboardingController extends OnboardingController {
  @override
  Future<bool> build() async => true;
}

void main() {
  testWidgets(
    'requesting OTP stays on login then opens verification directly',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          appConfigProvider.overrideWithValue(
            AppConfig(
              environment: AppEnvironment.development,
              apiBaseUrl: 'https://example.test/api/v1',
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
              enableNetworkLogs: false,
            ),
          ),
          authControllerProvider.overrideWith(_OtpFlowAuthController.new),
          onboardingControllerProvider.overrideWith(
            _SeenOnboardingController.new,
          ),
        ],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const HospitalBookingApp(),
        ),
      );
      await tester.pumpAndSettle();
      container.read(appRouterProvider).go('/login');
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(EditableText), '0912345678');
      await tester.tap(find.text('Gửi mã OTP'));
      await tester.pump();

      expect(find.text('Đăng nhập bệnh nhân'), findsOneWidget);
      expect(find.text('Chăm sóc sức khỏe dễ dàng hơn'), findsNothing);

      final authController =
          container.read(authControllerProvider.notifier)
              as _OtpFlowAuthController;
      authController.completeRequest();
      await tester.pumpAndSettle();

      expect(find.text('Xác thực OTP'), findsOneWidget);
      expect(find.text('Chăm sóc sức khỏe dễ dàng hơn'), findsNothing);
    },
  );
}
