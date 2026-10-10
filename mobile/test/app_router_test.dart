import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/hospital_booking_app.dart';
import 'package:hospital_booking_mobile/app/router/app_router.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';

class _OtpFlowAuthController extends AuthController {
  final _requestGate = Completer<void>();

  @override
  AuthState build() => const AuthState.unauthenticated();

  @override
  Future<bool> requestOtp(String phone, {String? returnTo}) async {
    state = AuthState(
      status: AuthStatus.requestingOtp,
      phone: phone,
      returnTo: returnTo,
    );
    await _requestGate.future;
    state = AuthState(
      status: AuthStatus.awaitingOtp,
      phone: phone,
      challenge: OtpChallenge(
        challengeId: 'challenge-test',
        expiresAt: DateTime(2030),
      ),
      returnTo: returnTo,
    );
    return true;
  }

  @override
  Future<bool> verifyOtp(String otp) async {
    state = state.copyWith(status: AuthStatus.verifyingOtp);
    state = AuthState(
      status: AuthStatus.authenticated,
      user: const PatientUser(
        id: 'patient-1',
        fullName: 'Nguyễn Văn An',
        isPhoneVerified: true,
      ),
      returnTo: state.returnTo,
    );
    return true;
  }

  void completeRequest() => _requestGate.complete();
}

class _SeenOnboardingController extends OnboardingController {
  @override
  Future<bool> build() async => true;
}

class _IdleHomeContentController extends HomeContentController {
  @override
  HomeContentState build() => const HomeContentState();
}

class _GuestAuthController extends AuthController {
  @override
  AuthState build() => const AuthState.unauthenticated();
}

class _IdleAppointmentsController extends AppointmentsController {
  @override
  AppointmentsState build() => const AppointmentsState();
}

class _CatalogBookingFlowController extends BookingFlowController {
  @override
  BookingFlowState build() => const BookingFlowState(
    departments: [BookingDepartment(id: 'department-1', name: 'Tim mạch')],
    doctors: [
      BookingDoctor(
        id: 'doctor-1',
        fullName: 'Nguyễn Văn An',
        departmentId: 'department-1',
        departmentName: 'Tim mạch',
        consultationFee: 250000,
      ),
    ],
  );
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
          homeContentControllerProvider.overrideWith(
            _IdleHomeContentController.new,
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

  testWidgets('floating navigation switches between public main branches', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
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
        authControllerProvider.overrideWith(_GuestAuthController.new),
        onboardingControllerProvider.overrideWith(
          _SeenOnboardingController.new,
        ),
        homeContentControllerProvider.overrideWith(
          _IdleHomeContentController.new,
        ),
        bookingFlowControllerProvider.overrideWith(
          _CatalogBookingFlowController.new,
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

    expect(find.byTooltip('Trang chủ'), findsOneWidget);
    expect(find.byTooltip('Đặt khám'), findsOneWidget);

    await tester.tap(find.byTooltip('Đặt khám'));
    await tester.pumpAndSettle();

    expect(
      container.read(appRouterProvider).routeInformationProvider.value.uri.path,
      '/booking',
    );
    expect(find.text('Chọn lịch khám phù hợp'), findsOneWidget);

    await tester.tap(find.byTooltip('Trang chủ'));
    await tester.pumpAndSettle();

    expect(
      container.read(appRouterProvider).routeInformationProvider.value.uri.path,
      '/home',
    );
  });

  testWidgets('OTP login returns to the protected destination', (tester) async {
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
        homeContentControllerProvider.overrideWith(
          _IdleHomeContentController.new,
        ),
        appointmentsControllerProvider.overrideWith(
          _IdleAppointmentsController.new,
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

    container.read(appRouterProvider).go('/appointments');
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập bệnh nhân'), findsOneWidget);

    await tester.enterText(find.byType(EditableText), '0912345678');
    await tester.tap(find.text('Gửi mã OTP'));
    await tester.pump();
    final authController =
        container.read(authControllerProvider.notifier)
            as _OtpFlowAuthController;
    authController.completeRequest();
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText), '123456');
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(find.text('Lịch khám của tôi'), findsWidgets);
    expect(find.text('Đăng nhập bệnh nhân'), findsNothing);
    expect(find.byTooltip('Trang chủ'), findsOneWidget);
    expect(find.byTooltip('Lịch khám'), findsOneWidget);
    expect(find.byTooltip('Đặt khám'), findsOneWidget);
    expect(find.byTooltip('Trợ lý'), findsOneWidget);
    expect(find.byTooltip('Tài khoản'), findsOneWidget);
  });

  testWidgets('public department routes remain available to guests', (
    tester,
  ) async {
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
        authControllerProvider.overrideWith(_GuestAuthController.new),
        onboardingControllerProvider.overrideWith(
          _SeenOnboardingController.new,
        ),
        homeContentControllerProvider.overrideWith(
          _IdleHomeContentController.new,
        ),
        bookingFlowControllerProvider.overrideWith(
          _CatalogBookingFlowController.new,
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

    container.read(appRouterProvider).go('/departments');
    await tester.pumpAndSettle();
    expect(find.text('Tìm đúng nơi chăm sóc'), findsOneWidget);

    container.read(appRouterProvider).go('/departments/department-1');
    await tester.pumpAndSettle();
    expect(find.text('Đặt lịch chuyên khoa này'), findsOneWidget);
    expect(find.text('Nguyễn Văn An'), findsOneWidget);
  });
}
