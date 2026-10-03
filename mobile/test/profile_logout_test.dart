import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_screen.dart';

const _user = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  email: 'an@example.test',
  isPhoneVerified: true,
);

class _AuthenticatedController extends AuthController {
  int logoutCalls = 0;

  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _user);

  @override
  Future<bool> logout() async {
    if (state.isLoggingOut) return false;
    logoutCalls += 1;
    state = const AuthState(status: AuthStatus.loggingOut, user: _user);
    await Future<void>.delayed(const Duration(milliseconds: 10));
    state = const AuthState.loggedOut();
    return true;
  }
}

class _IdleSubmissionController extends BookingSubmissionController {
  @override
  BookingSubmissionState build() => const BookingSubmissionState.idle();
}

class _PendingSubmissionController extends BookingSubmissionController {
  bool resetCalled = false;

  @override
  BookingSubmissionState build() => BookingSubmissionState(
    status: BookingSubmissionStatus.awaitingOtp,
    pending: PendingBooking(
      appointmentId: 'appointment-1',
      bookingCode: 'HB-1001',
      patientPhone: '0912345678',
      expiresIn: 300,
      holdExpiresAt: DateTime.now().add(const Duration(minutes: 5)),
    ),
  );

  @override
  Future<void> reset() async {
    resetCalled = true;
    state = const BookingSubmissionState.idle();
  }
}

class _DraftBookingController extends BookingFlowController {
  bool clearCalled = false;

  @override
  BookingFlowState build() => const BookingFlowState(
    selection: BookingSelection(
      departmentId: 'department-1',
      doctorId: 'doctor-1',
      date: '2030-01-02',
      slotId: 'slot-1',
    ),
  );

  @override
  Future<void> clearSelection() async {
    clearCalled = true;
    state = const BookingFlowState();
  }
}

GoRouter _router() => GoRouter(
  initialLocation: '/profile',
  routes: [
    GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    GoRoute(
      path: '/home',
      builder: (_, _) => const Scaffold(body: Text('Trang chủ khách')),
    ),
    GoRoute(
      path: '/booking/verify',
      builder: (_, _) => const Scaffold(body: Text('Màn xác thực lịch')),
    ),
  ],
);

void main() {
  testWidgets('logout requires confirmation and returns to guest home', (
    tester,
  ) async {
    final auth = _AuthenticatedController();
    final router = _router();
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(() => auth),
          bookingSubmissionControllerProvider.overrideWith(
            _IdleSubmissionController.new,
          ),
          bookingFlowControllerProvider.overrideWith(
            _DraftBookingController.new,
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Đăng xuất thiết bị này'));
    await tester.pumpAndSettle();
    expect(find.text('Đăng xuất khỏi thiết bị?'), findsOneWidget);

    await tester.tap(find.text('Ở lại'));
    await tester.pumpAndSettle();
    expect(auth.logoutCalls, 0);
    expect(find.text('Hồ sơ bệnh nhân'), findsOneWidget);

    await tester.tap(find.text('Đăng xuất thiết bị này'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đăng xuất'));
    await tester.pumpAndSettle();

    expect(auth.logoutCalls, 1);
    expect(find.text('Trang chủ khách'), findsOneWidget);
    expect(find.text('Đã đăng xuất khỏi thiết bị này.'), findsOneWidget);
  });

  testWidgets('pending OTP must be resumed or explicitly discarded', (
    tester,
  ) async {
    final auth = _AuthenticatedController();
    final submission = _PendingSubmissionController();
    final booking = _DraftBookingController();
    final router = _router();
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(() => auth),
          bookingSubmissionControllerProvider.overrideWith(() => submission),
          bookingFlowControllerProvider.overrideWith(() => booking),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Đăng xuất thiết bị này'));
    await tester.pumpAndSettle();

    expect(find.text('Bạn còn lịch chờ xác thực'), findsOneWidget);
    expect(find.textContaining('HB-1001'), findsOneWidget);
    expect(find.text('Tiếp tục xác thực'), findsOneWidget);

    await tester.tap(find.text('Đăng xuất và bỏ phiên'));
    await tester.pumpAndSettle();

    expect(submission.resetCalled, isTrue);
    expect(booking.clearCalled, isTrue);
    expect(auth.logoutCalls, 1);
    expect(find.text('Trang chủ khách'), findsOneWidget);
  });
}
