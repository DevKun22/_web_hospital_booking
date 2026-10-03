import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

const _protectedPrefixes = <String>[
  '/profile',
  '/appointments',
  '/medical-records',
  '/prescriptions',
  '/invoices',
];

String? safeReturnLocation(String? value) {
  if (value == null || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  final uri = Uri.tryParse(value);
  if (uri == null || uri.hasAuthority) return null;
  if ({'/splash', '/welcome', '/login', '/verify-otp'}.contains(uri.path)) {
    return null;
  }
  return uri.toString();
}

String loginLocation(String returnTo) =>
    Uri(path: '/login', queryParameters: {'from': returnTo}).toString();

String verifyOtpLocation(String? returnTo) => Uri(
  path: '/verify-otp',
  queryParameters: returnTo == null ? null : {'from': returnTo},
).toString();

String? resolveAppRedirect({
  required AuthStatus authStatus,
  required bool hasChallenge,
  required bool? welcomeSeen,
  required String location,
  String? returnTo,
}) {
  final isAuthRoute = location == '/login' || location == '/verify-otp';
  final normalizedReturnTo = safeReturnLocation(returnTo);

  if (authStatus == AuthStatus.bootstrapping ||
      authStatus == AuthStatus.offline) {
    return location == '/splash' ? null : '/splash';
  }

  if (authStatus == AuthStatus.authenticated) {
    if (location == '/splash' || location == '/welcome' || isAuthRoute) {
      return normalizedReturnTo ?? '/home';
    }
    return null;
  }

  if ((authStatus == AuthStatus.awaitingOtp ||
          authStatus == AuthStatus.verifyingOtp) &&
      hasChallenge) {
    return location == '/verify-otp'
        ? null
        : verifyOtpLocation(normalizedReturnTo);
  }

  if (welcomeSeen == null) {
    return location == '/splash' ? null : '/splash';
  }

  if (!welcomeSeen && location == '/splash') return '/welcome';
  if (welcomeSeen && (location == '/splash' || location == '/welcome')) {
    return '/home';
  }

  if (location == '/verify-otp') {
    return normalizedReturnTo == null
        ? '/login'
        : loginLocation(normalizedReturnTo);
  }

  final isProtected = _protectedPrefixes.any(
    (prefix) => location == prefix || location.startsWith('$prefix/'),
  );
  if (isProtected) return loginLocation(location);

  return null;
}
