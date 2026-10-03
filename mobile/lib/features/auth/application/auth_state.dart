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

enum AuthErrorOrigin { sessionRestore, session, requestOtp, verifyOtp }

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.phone,
    this.challenge,
    this.error,
    this.errorOrigin,
  }) : assert(
         (error == null && errorOrigin == null) ||
             (error != null && errorOrigin != null),
         'An authentication error must always declare its UI origin.',
       );

  const AuthState.bootstrapping() : this(status: AuthStatus.bootstrapping);
  const AuthState.unauthenticated({
    ApiException? error,
    AuthErrorOrigin? errorOrigin,
  }) : this(
         status: AuthStatus.unauthenticated,
         error: error,
         errorOrigin: errorOrigin,
       );

  final AuthStatus status;
  final PatientUser? user;
  final String? phone;
  final OtpChallenge? challenge;
  final ApiException? error;
  final AuthErrorOrigin? errorOrigin;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;
  bool get isBusy =>
      status == AuthStatus.requestingOtp || status == AuthStatus.verifyingOtp;

  ApiException? errorFor(AuthErrorOrigin origin) =>
      errorOrigin == origin ? error : null;

  AuthState copyWith({
    AuthStatus? status,
    PatientUser? user,
    String? phone,
    OtpChallenge? challenge,
    ApiException? error,
    AuthErrorOrigin? errorOrigin,
    bool clearError = false,
  }) => AuthState(
    status: status ?? this.status,
    user: user ?? this.user,
    phone: phone ?? this.phone,
    challenge: challenge ?? this.challenge,
    error: clearError ? null : error ?? this.error,
    errorOrigin: clearError ? null : errorOrigin ?? this.errorOrigin,
  );
}
