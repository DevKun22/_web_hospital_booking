import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _sessionSubscription;
  bool _logoutInFlight = false;

  @override
  AuthState build() {
    _sessionSubscription = ref.read(sessionEventsProvider).invalidated.listen((
      _,
    ) {
      state = const AuthState.unauthenticated(
        error: ApiException(
          kind: ApiErrorKind.unauthorized,
          code: 'SESSION_INVALIDATED',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        ),
        errorOrigin: AuthErrorOrigin.session,
      );
    });
    ref.onDispose(() => _sessionSubscription?.cancel());
    Future<void>.microtask(bootstrapSession);
    return const AuthState.bootstrapping();
  }

  Future<void> bootstrapSession() async {
    state = const AuthState.bootstrapping();
    try {
      final session = await ref.read(authRepositoryProvider).restoreSession();
      state = session == null
          ? const AuthState.unauthenticated()
          : AuthState(status: AuthStatus.authenticated, user: session.user);
    } on ApiException catch (error) {
      if (error.kind == ApiErrorKind.network ||
          error.kind == ApiErrorKind.timeout) {
        state = AuthState(
          status: AuthStatus.offline,
          error: error,
          errorOrigin: AuthErrorOrigin.sessionRestore,
        );
      } else {
        state = AuthState.unauthenticated(
          error: error,
          errorOrigin: AuthErrorOrigin.session,
        );
      }
    }
  }

  void continueOffline() {
    if (state.status != AuthStatus.offline) return;
    state = AuthState(
      status: AuthStatus.offlineBrowsing,
      error: state.error,
      errorOrigin: state.errorOrigin,
    );
  }

  Future<bool> requestOtp(String phone, {String? returnTo}) async {
    state = AuthState(
      status: AuthStatus.requestingOtp,
      phone: phone,
      returnTo: returnTo,
    );
    try {
      final challenge = await ref
          .read(authRepositoryProvider)
          .requestOtp(phone);
      state = AuthState(
        status: AuthStatus.awaitingOtp,
        phone: phone,
        challenge: challenge,
        returnTo: returnTo,
      );
      return true;
    } on ApiException catch (error) {
      state = AuthState.unauthenticated(
        error: error,
        errorOrigin: AuthErrorOrigin.requestOtp,
      ).copyWith(phone: phone, returnTo: returnTo);
      return false;
    }
  }

  Future<bool> verifyOtp(String otp) async {
    final challenge = state.challenge;
    if (challenge == null) {
      state = const AuthState.unauthenticated();
      return false;
    }

    state = state.copyWith(status: AuthStatus.verifyingOtp, clearError: true);
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .verifyOtp(challengeId: challenge.challengeId, otp: otp);
      state = AuthState(
        status: AuthStatus.authenticated,
        user: session.user,
        returnTo: state.returnTo,
      );
      return true;
    } on ApiException catch (error) {
      state = state.copyWith(
        status: AuthStatus.awaitingOtp,
        error: error,
        errorOrigin: AuthErrorOrigin.verifyOtp,
      );
      return false;
    }
  }

  Future<bool> logout() async {
    if (_logoutInFlight) return false;
    _logoutInFlight = true;
    final user = state.user;
    state = AuthState(status: AuthStatus.loggingOut, user: user);
    try {
      await ref.read(authRepositoryProvider).logout();
      state = const AuthState.loggedOut();
      return true;
    } finally {
      _logoutInFlight = false;
      if (state.status == AuthStatus.loggingOut) {
        state = const AuthState.loggedOut();
      }
    }
  }

  void syncUser(PatientUser user) {
    if (!state.isAuthenticated || state.user?.id != user.id) return;
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  void restartLogin() => state = const AuthState.unauthenticated();

  void dismissError() => state = state.copyWith(clearError: true);
}
