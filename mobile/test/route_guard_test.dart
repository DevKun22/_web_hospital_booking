import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

String? _redirect(AuthStatus status, String location, {String? returnTo}) =>
    resolveAppRedirect(
      authStatus: status,
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

  test('authenticated user leaves login for the return location', () {
    expect(_redirect(AuthStatus.authenticated, '/login'), '/home');
    expect(
      _redirect(AuthStatus.authenticated, '/login', returnTo: '/appointments'),
      '/appointments',
    );
    expect(_redirect(AuthStatus.authenticated, '/appointments'), isNull);
  });

  test('OTP step stays where the user is (login screen or gated screen)', () {
    for (final status in [AuthStatus.awaitingOtp, AuthStatus.verifyingOtp]) {
      for (final location in ['/login', '/appointments', '/profile']) {
        expect(_redirect(status, location, returnTo: '/x'), isNull);
      }
    }
  });

  test('external and auth-loop return locations are rejected', () {
    expect(safeReturnLocation('https://evil.example'), isNull);
    expect(safeReturnLocation('//evil.example'), isNull);
    expect(safeReturnLocation('/login'), isNull);
    expect(safeReturnLocation('/appointments?x=1'), '/appointments?x=1');
  });
}
