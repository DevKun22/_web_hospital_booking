import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_messaging_gateway.dart';

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

  Future<bool> requestOtp(
    String email, {
    String? returnTo,
    String? termsVersion,
  }) async {
    state = AuthState(
      status: AuthStatus.requestingOtp,
      email: email,
      returnTo: returnTo,
    );
    try {
      final challenge = await ref
          .read(authRepositoryProvider)
          .requestOtp(email, termsVersion: termsVersion);
      state = AuthState(
        status: AuthStatus.awaitingOtp,
        email: email,
        challenge: challenge,
        returnTo: returnTo,
      );
      return true;
    } on ApiException catch (error) {
      state = AuthState.unauthenticated(
        error: error,
        errorOrigin: AuthErrorOrigin.requestOtp,
      ).copyWith(email: email, returnTo: returnTo);
      return false;
    }
  }

  /// Gửi lại mã khi đang ở bước nhập mã. Giữ nguyên thử thách hiện tại cho tới khi có mã mới, nên gửi lại
  /// thất bại (còn trong thời gian chờ, quá giới hạn, mất mạng) không làm mất mã người dùng đang có trong email.
  Future<bool> resendOtp({String? termsVersion}) async {
    final email = state.email;
    if (email == null ||
        state.challenge == null ||
        state.status != AuthStatus.awaitingOtp) {
      return false;
    }
    state = state.copyWith(clearError: true);
    try {
      final challenge = await ref
          .read(authRepositoryProvider)
          .requestOtp(email, termsVersion: termsVersion);
      // Người dùng đã đổi email hoặc rời luồng trong lúc chờ: bỏ kết quả.
      if (state.status != AuthStatus.awaitingOtp || state.email != email) {
        return false;
      }
      state = state.copyWith(challenge: challenge, clearError: true);
      return true;
    } on ApiException catch (error) {
      if (state.status != AuthStatus.awaitingOtp || state.email != email) {
        return false;
      }
      state = state.copyWith(
        error: error,
        errorOrigin: AuthErrorOrigin.requestOtp,
      );
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

  /// Đăng nhập bằng phiên máy chủ vừa cấp (sau OTP đặt lịch). Lỗi lưu phiên chỉ khiến người dùng phải đăng nhập lại như cũ.
  Future<void> adoptSession(AuthSession session) async {
    try {
      await ref.read(authRepositoryProvider).adoptSession(session);
      state = AuthState(status: AuthStatus.authenticated, user: session.user);
    } catch (error) {
      logSwallowedError('auth_controller.adoptSession', error);
    }
  }

  Future<bool> logout() async {
    if (_logoutInFlight) return false;
    _logoutInFlight = true;
    final user = state.user;
    state = AuthState(status: AuthStatus.loggingOut, user: user);
    try {
      await ref.read(authRepositoryProvider).logout();
      try {
        await ref.read(pushMessagingGatewayProvider).deleteToken();
      } catch (error) {
        logSwallowedError('auth_controller', error);
        // Logout remains successful when Firebase is temporarily unavailable.
      }
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
