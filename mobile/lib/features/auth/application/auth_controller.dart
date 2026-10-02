import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  StreamSubscription<void>? _sessionSubscription;

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
      state = AuthState(status: AuthStatus.authenticated, user: session.user);
    } on ApiException catch (error) {
      if (error.kind == ApiErrorKind.network ||
          error.kind == ApiErrorKind.timeout) {
        state = AuthState(status: AuthStatus.offline, error: error);
      } else {
        state = AuthState.unauthenticated(error: error);
      }
    }
  }

  Future<bool> requestOtp(String phone) async {
    state = AuthState(status: AuthStatus.requestingOtp, phone: phone);
    try {
      final challenge = await ref
          .read(authRepositoryProvider)
          .requestOtp(phone);
      state = AuthState(
        status: AuthStatus.awaitingOtp,
        phone: phone,
        challenge: challenge,
      );
      return true;
    } on ApiException catch (error) {
      state = AuthState.unauthenticated(error: error).copyWith(phone: phone);
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
      state = AuthState(status: AuthStatus.authenticated, user: session.user);
      return true;
    } on ApiException catch (error) {
      state = state.copyWith(status: AuthStatus.awaitingOtp, error: error);
      return false;
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState.unauthenticated();
  }

  void restartLogin() => state = const AuthState.unauthenticated();
}
