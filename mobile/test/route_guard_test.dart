import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

String? _redirect(
  AuthStatus status,
  String location, {
  bool hasChallenge = false,
  String? returnTo,
}) => resolveAppRedirect(
  authStatus: status,
  hasChallenge: hasChallenge,
  location: location,
  returnTo: returnTo,
);

void main() {
  test(
    'guest and restoring sessions never get redirected away from content',
    () {
      for (final status in [
        AuthStatus.bootstrapping,
        AuthStatus.unauthenticated,
        AuthStatus.loggedOut,
        AuthStatus.offline,
        AuthStatus.offlineBrowsing,
      ]) {
        for (final location in [
          '/home',
          '/appointments',
          '/profile',
          '/invoices/abc',
          '/doctors/1',
        ]) {
          expect(
            _redirect(status, location),
            isNull,
            reason: '$status $location',
          );
        }
      }
    },
  );

  test('authenticated user leaves auth routes for the return location', () {
    expect(_redirect(AuthStatus.authenticated, '/login'), '/home');
    expect(
      _redirect(
        AuthStatus.authenticated,
        '/verify-otp',
        returnTo: '/appointments',
      ),
      '/appointments',
    );
    expect(_redirect(AuthStatus.authenticated, '/appointments'), isNull);
  });

  test('OTP flow keeps the user on verify and preserves the destination', () {
    for (final status in [AuthStatus.awaitingOtp, AuthStatus.verifyingOtp]) {
      expect(
        _redirect(status, '/login', hasChallenge: true, returnTo: '/invoices'),
        '/verify-otp?from=%2Finvoices',
      );
      expect(
        _redirect(
          status,
          '/verify-otp',
          hasChallenge: true,
          returnTo: '/invoices',
        ),
        isNull,
      );
    }
  });

  test('verify screen without a challenge goes back to login', () {
    expect(_redirect(AuthStatus.unauthenticated, '/verify-otp'), '/login');
    expect(
      _redirect(
        AuthStatus.unauthenticated,
        '/verify-otp',
        returnTo: '/invoices',
      ),
      '/login?from=%2Finvoices',
    );
  });

  test('external and auth-loop return locations are rejected', () {
    expect(safeReturnLocation('https://evil.example'), isNull);
    expect(safeReturnLocation('//evil.example'), isNull);
    expect(safeReturnLocation('/login'), isNull);
    expect(safeReturnLocation('/verify-otp'), isNull);
    expect(safeReturnLocation('/appointments?x=1'), '/appointments?x=1');
  });
}
