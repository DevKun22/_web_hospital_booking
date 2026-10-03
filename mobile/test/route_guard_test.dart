import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

void main() {
  test('first unauthenticated launch opens welcome', () {
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.unauthenticated,
        hasChallenge: false,
        welcomeSeen: false,
        location: '/splash',
      ),
      '/welcome',
    );
  });

  test('returning guest opens public home', () {
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.unauthenticated,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/splash',
      ),
      '/home',
    );
  });

  test('guest is sent to login only for protected routes', () {
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.unauthenticated,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/profile',
      ),
      '/login?from=%2Fprofile',
    );
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.unauthenticated,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/booking',
      ),
      isNull,
    );
  });

  test('explicit logout leaves protected screens for guest home', () {
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.loggingOut,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/profile',
      ),
      isNull,
      reason: 'The profile must remain visible while logout is in progress.',
    );
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.loggedOut,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/profile',
      ),
      '/home',
    );
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.loggedOut,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/login',
      ),
      isNull,
      reason: 'A logged-out guest can still choose to sign in again.',
    );
  });

  test('OTP flow preserves the protected destination', () {
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.requestingOtp,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/login',
      ),
      isNull,
      reason: 'Requesting OTP must remain on the login screen',
    );
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.awaitingOtp,
        hasChallenge: true,
        welcomeSeen: true,
        location: '/login',
        returnTo: '/profile',
      ),
      '/verify-otp?from=%2Fprofile',
    );
    expect(
      resolveAppRedirect(
        authStatus: AuthStatus.authenticated,
        hasChallenge: false,
        welcomeSeen: true,
        location: '/verify-otp',
        returnTo: '/profile',
      ),
      '/profile',
    );
  });

  test('external and auth-loop return locations are rejected', () {
    expect(safeReturnLocation('https://malicious.example'), isNull);
    expect(safeReturnLocation('//malicious.example/path'), isNull);
    expect(safeReturnLocation('/verify-otp'), isNull);
    expect(safeReturnLocation('/appointments/123'), '/appointments/123');
  });
}
