import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

/// Chỉ nhận đường dẫn nội bộ làm điểm quay lại sau đăng nhập; chặn địa chỉ ngoài và vòng lặp về màn đăng nhập.
String? safeReturnLocation(String? value) {
  if (value == null || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  final uri = Uri.tryParse(value);
  if (uri == null || uri.hasAuthority) return null;
  if ({'/login', '/verify-otp'}.contains(uri.path)) return null;
  return uri.toString();
}

String loginLocation(String returnTo) =>
    Uri(path: '/login', queryParameters: {'from': returnTo}).toString();

String verifyOtpLocation(String? returnTo) => Uri(
  path: '/verify-otp',
  queryParameters: returnTo == null ? null : {'from': returnTo},
).toString();

/// Định tuyến chỉ lo luồng đăng nhập. Màn cần tài khoản tự mời đăng nhập tại chỗ (xem `AuthGate`), nên không còn
/// chuyển hướng theo từng loại đường dẫn hay màn khởi động.
String? resolveAppRedirect({
  required AuthStatus authStatus,
  required bool hasChallenge,
  required String location,
  String? returnTo,
}) {
  final normalizedReturnTo = safeReturnLocation(returnTo);
  final isAuthRoute = location == '/login' || location == '/verify-otp';

  if (authStatus == AuthStatus.authenticated) {
    return isAuthRoute ? (normalizedReturnTo ?? '/home') : null;
  }

  if ((authStatus == AuthStatus.awaitingOtp ||
          authStatus == AuthStatus.verifyingOtp) &&
      hasChallenge) {
    return location == '/verify-otp'
        ? null
        : verifyOtpLocation(normalizedReturnTo);
  }

  if (location == '/verify-otp') {
    return normalizedReturnTo == null
        ? '/login'
        : loginLocation(normalizedReturnTo);
  }

  return null;
}
