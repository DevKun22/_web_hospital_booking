import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken']?.toString() ?? '',
    refreshToken: json['refreshToken']?.toString() ?? '',
    user: PatientUser.fromJson(
      Map<String, dynamic>.from(json['user'] as Map? ?? const {}),
    ),
  );

  final String accessToken;
  final String refreshToken;
  final PatientUser user;

  bool get isValid =>
      accessToken.isNotEmpty && refreshToken.isNotEmpty && user.id.isNotEmpty;
}

class OtpChallenge {
  const OtpChallenge({
    required this.challengeId,
    required this.expiresAt,
    this.deliveryStatus,
    this.debugOtp,
  });

  factory OtpChallenge.fromJson(Map<String, dynamic> json) => OtpChallenge(
    challengeId: json['challengeId']?.toString() ?? '',
    expiresAt:
        DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
        DateTime.now().add(const Duration(minutes: 5)),
    deliveryStatus: json['deliveryStatus']?.toString(),
    debugOtp: json['debugOtp']?.toString(),
  );

  final String challengeId;
  final DateTime expiresAt;
  final String? deliveryStatus;
  final String? debugOtp;
}
