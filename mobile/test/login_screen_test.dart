import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_screen.dart';

class _GuestAuthController extends AuthController {
  @override
  AuthState build() => const AuthState.unauthenticated();
}

void main() {
  testWidgets('system back leaves login without mutating state during build', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('Trang chủ kiểm thử')),
        ),
        GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_GuestAuthController.new),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    router.push('/login');
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập bệnh nhân'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('Trang chủ kiểm thử'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
