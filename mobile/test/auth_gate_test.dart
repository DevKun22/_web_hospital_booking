import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/auth_gate.dart';
import 'package:hospital_booking_mobile/features/onboarding/presentation/first_run_gate.dart';

class _StubAuth extends AuthController {
  _StubAuth(this._state);

  final AuthState _state;
  int bootstraps = 0;

  @override
  AuthState build() => _state;

  @override
  Future<void> bootstrapSession() async => bootstraps++;
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
    expect(find.text('Đăng nhập để xem lịch hẹn'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
    await tester.pumpAndSettle();
    expect(find.text('Màn đăng nhập'), findsOneWidget);
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
