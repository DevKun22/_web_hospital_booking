import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/splash_screen.dart';

class _OfflineAuthController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.offline,
    error: ApiException(
      kind: ApiErrorKind.network,
      message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.',
    ),
    errorOrigin: AuthErrorOrigin.sessionRestore,
  );
}

void main() {
  testWidgets('offline session can continue with cached public content', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_OfflineAuthController.new),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: SplashScreen()),
      ),
    );

    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.text('Xem nội dung đã lưu'), findsOneWidget);

    await tester.tap(find.text('Xem nội dung đã lưu'));
    await tester.pump();

    final state = container.read(authControllerProvider);
    expect(state.status, AuthStatus.offlineBrowsing);
    expect(state.errorOrigin, AuthErrorOrigin.sessionRestore);
  });
}
