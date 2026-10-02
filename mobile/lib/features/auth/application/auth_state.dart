import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

enum AuthStatus {
  bootstrapping,
  unauthenticated,
  requestingOtp,
  awaitingOtp,
  verifyingOtp,
  authenticated,
  offline,
}

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.phone,
    this.challenge,
    this.error,
  });

  const AuthState.bootstrapping() : this(status: AuthStatus.bootstrapping);
  const AuthState.unauthenticated({ApiException? error})
    : this(status: AuthStatus.unauthenticated, error: error);

  final AuthStatus status;
  final PatientUser? user;
  final String? phone;
  final OtpChallenge? challenge;
  final ApiException? error;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;
  bool get isBusy =>
      status == AuthStatus.requestingOtp || status == AuthStatus.verifyingOtp;

  AuthState copyWith({
    AuthStatus? status,
    PatientUser? user,
    String? phone,
    OtpChallenge? challenge,
    ApiException? error,
    bool clearError = false,
  }) => AuthState(
    status: status ?? this.status,
    user: user ?? this.user,
    phone: phone ?? this.phone,
    challenge: challenge ?? this.challenge,
    error: clearError ? null : error ?? this.error,
  );
}
