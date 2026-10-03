import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';

class _OtpErrorAuthController extends AuthController {
  @override
  AuthState build() => const AuthState.unauthenticated(
    error: ApiException(
      kind: ApiErrorKind.rateLimited,
      message: 'Vui lòng đợi trước khi gửi lại OTP.',
    ),
    errorOrigin: AuthErrorOrigin.requestOtp,
  );
}

void main() {
  testWidgets('home never renders an OTP request error', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('Chăm sóc sức khỏe dễ dàng hơn'), findsOneWidget);
    expect(find.text('Vui lòng đợi trước khi gửi lại OTP.'), findsNothing);
  });
}
