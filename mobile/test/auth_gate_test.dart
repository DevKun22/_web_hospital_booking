import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/auth_gate.dart';
import 'package:hospital_booking_mobile/features/onboarding/presentation/first_run_gate.dart';

class _StubAuth extends AuthController {
  _StubAuth(this._state);

  final AuthState _state;
  int bootstraps = 0;

  @override
  AuthState build() => _state;

  final verified = <String>[];

  @override
  Future<void> bootstrapSession() async => bootstraps++;

  @override
  Future<bool> verifyOtp(String otp) async {
    verified.add(otp);
    return true;
  }
}

Future<_StubAuth> _pump(WidgetTester tester, AuthState state) async {
  final stub = _StubAuth(state);
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) =>
            const AuthGate(title: 'lịch hẹn', child: Text('Nội dung riêng tư')),
      ),
      GoRoute(path: '/login', builder: (_, _) => const Text('Màn đăng nhập')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authControllerProvider.overrideWith(() => stub)],
      child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return stub;
}

void main() {
  testWidgets('signed-in user sees the protected content', (tester) async {
    await _pump(
      tester,
      const AuthState(
        status: AuthStatus.authenticated,
        user: PatientUser(id: '1', fullName: 'An', isEmailVerified: true),
      ),
    );
    expect(find.text('Nội dung riêng tư'), findsOneWidget);
  });

  testWidgets('guest is invited to sign in on the same screen', (tester) async {
    await _pump(tester, const AuthState.unauthenticated());
    expect(find.text('Nội dung riêng tư'), findsNothing);
    // Khối đăng nhập hiện ngay tại màn, không phải bấm sang màn khác.
    expect(find.text('Đăng nhập người khám'), findsOneWidget);
    expect(find.textContaining('Đăng nhập để xem lịch hẹn'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
    expect(find.text('Màn đăng nhập'), findsNothing);
  });

  testWidgets('a sent code switches the gate to the 6-digit step', (
    tester,
  ) async {
    final stub = await _pump(
      tester,
      AuthState(
        status: AuthStatus.awaitingOtp,
        email: 'an@example.com',
        challenge: OtpChallenge(
          challengeId: 'c1',
          expiresAt: DateTime(2099),
          maskedTarget: 'a***@example.com',
        ),
      ),
    );
    expect(find.text('Nhập mã 6 số'), findsOneWidget);
    expect(find.textContaining('a***@example.com'), findsOneWidget);

    // Dán đủ 6 số thì tự xác nhận.
    await tester.enterText(find.byType(TextField), '123456');
    await tester.pump();
    expect(stub.verified, ['123456']);
  });

  testWidgets('offline offers a retry that restores the session', (
    tester,
  ) async {
    final stub = await _pump(
      tester,
      const AuthState(status: AuthStatus.offline),
    );
    expect(find.text('Chưa kết nối được máy chủ'), findsOneWidget);

    await tester.tap(find.text('Thử lại'));
    await tester.pump();
    expect(stub.bootstraps, 1);
  });

  testWidgets('first run sheet shows once and is remembered', (tester) async {
    final preferences = MemoryAppPreferences();
    Future<void> open() async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [appPreferencesProvider.overrideWithValue(preferences)],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const FirstRunGate(child: Scaffold(body: Text('Trang chủ'))),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await open();
    expect(find.text('Chào mừng đến DevKunCare'), findsOneWidget);
    await tester.tap(find.text('Bắt đầu'));
    await tester.pumpAndSettle();
    expect(preferences.welcomeSeen, isTrue);

    await tester.pumpWidget(const SizedBox());
    await open();
    expect(find.text('Chào mừng đến DevKunCare'), findsNothing);
    expect(find.text('Trang chủ'), findsOneWidget);
  });
}
