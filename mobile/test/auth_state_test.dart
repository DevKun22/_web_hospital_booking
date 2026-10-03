import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

void main() {
  const otpError = ApiException(
    kind: ApiErrorKind.rateLimited,
    message: 'Vui lòng đợi trước khi gửi lại OTP',
  );

  test('guest state is normal and has no visible authentication error', () {
    const state = AuthState.unauthenticated();

    expect(state.error, isNull);
    expect(state.errorOrigin, isNull);
  });

  test('an OTP request error is visible only in the login context', () {
    const state = AuthState.unauthenticated(
      error: otpError,
      errorOrigin: AuthErrorOrigin.requestOtp,
    );

    expect(state.errorFor(AuthErrorOrigin.requestOtp), same(otpError));
    expect(state.errorFor(AuthErrorOrigin.session), isNull);
    expect(state.errorFor(AuthErrorOrigin.verifyOtp), isNull);
  });

  test('clearing an error also clears its UI origin', () {
    const state = AuthState.unauthenticated(
      error: otpError,
      errorOrigin: AuthErrorOrigin.requestOtp,
    );

    final cleared = state.copyWith(clearError: true);

    expect(cleared.error, isNull);
    expect(cleared.errorOrigin, isNull);
  });
}
